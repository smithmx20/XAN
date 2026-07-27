// lib/allanime-crypto.ts
// ✅ AllAnime mkissa.to direct-crypto resolver — ported from XAN's
//    cf-worker/worker.js (which is the canonical, production-tested version).
//    Mirrors https://github.com/smithP2007/XANCLD/blob/main/src/worker/allanimeCrypto.ts
//    but with self-healing MASK/BUILD_ID discovery (crawls mkissa.to's SvelteKit
//    bundle at runtime) so we don't need a GitHub Action to keep the MASK fresh.
//
// As of mid-2026, AllAnime migrated from allmanga.to to mkissa.to and now
// requires a signed `aaReq` extension on every episode GraphQL query.
// Without it, the server returns `AA_CRYPTO_MISSING` and zero sources.
//
// The crypto scheme (reverse-engineered from mkissa.to's SvelteKit bundle):
//
//   1. AllAnime embeds window.__aaCrypto = {epoch, partB} in the page HTML
//      (mkissa.to returns 200 with no Cloudflare challenge)
//   2. The AES key is derived: key = XOR(atob(partB), hexToBytes(MASK))
//      where MASK is a 64-hex string baked into mkissa.to's JS bundle.
//      ⚠️ MASK rotates every time mkissa.to deploys a new build.
//   3. For each episode query, build a signed "aaReq" extension:
//      a. ts = Math.floor(Date.now() / 300000) * 300000  (5-min bucket)
//      b. payload = JSON.stringify({v:1, ts, epoch, buildId, qh:queryHash})
//      c. iv = SHA-256(epoch + ":" + buildId + ":" + queryHash + ":" + ts).slice(0, 12)
//      d. encrypted = AES-GCM-encrypt(key, iv, payload)
//      e. aaReq = base64([0x01][iv(12)][encrypted+tag])
//   4. POST to https://api.allanime.day/api with:
//      - body: {query, variables, extensions: {persistedQuery, aaReq}}
//      - headers: Content-Type: application/json, x-build-id: <buildId>
//   5. Server returns tobeparsed (encrypted with the same key, AES-GCM)
//      — the OLD sha256("Xot36i3lK3:v1") key still works as a fallback
//   6. Decrypt tobeparsed → {episode: {sourceUrls: [...]}}
//
// MASK/BUILD_ID self-healing:
//   - On cold start: use FALLBACK_MASK_HEX / FALLBACK_BUILD_ID (kept fresh by
//     the refresh-mkissa-mask.yml GitHub Action running on the XAN cf-worker).
//   - On AA_CRYPTO_STALE: discover fresh MASK/BUILD_ID by crawling
//     mkissa.to's JS chunks (extractMaskAndBuildId + discoverMaskFromMkissa).
//   - Cache discovered values for 24h so subsequent requests are fast.

import { createHash, createDecipheriv, createCipheriv } from "crypto";

// ─── MASK / BUILD_ID — self-healing with hardcoded fallback ───────────────
// FALLBACK values are kept fresh by the refresh-mkissa-mask.yml GitHub Action
// in the XAN repo (auto-commits every day). They're also updated manually
// when the discovery pattern shape changes.
//
// Last updated: 2026-07-26 by GitHub Action
const FALLBACK_MASK_HEX = "70c93af3f266f2f94b9a8a5373e5c8a07d6114759d1516a44b845dd29aec7ab5";
const FALLBACK_BUILD_ID = "70";

// Runtime cache for discovered MASK/BUILD_ID. Lives for the lifetime of the
// Next.js server process. TTL is 24h — discovery is expensive (~13 subrequests).
const DISCOVERED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let discoveredCrypto: {
  mask: string;
  buildId: string;
  expiresAt: number;
} | null = null;

const OLD_KEY_STR = "Xot36i3lK3:v1";
const ALLANIME_API = "https://api.allanime.day/api";
const MKISSA_ORIGIN = "https://mkissa.to/";
const MKISSA_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MKISSA_EPISODE_URL = (showId: string, ep: string, mode: string) =>
  `https://mkissa.to/watch/${showId}/p-${ep}-${mode}`;

export interface SourceUrl {
  sourceName: string;
  sourceUrl: string;
  priority: number;
  type: string;
}

export interface EpisodeResolveResult {
  sources: SourceUrl[] | null;
  cached?: boolean;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────
function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

function sha256(data: Buffer | string): Buffer {
  return createHash("sha256").update(data).digest();
}

function sha256Hex(data: Buffer | string): string {
  return sha256(data).toString("hex");
}

function getOldKey(): Buffer {
  return createHash("sha256").update(OLD_KEY_STR).digest();
}

// Derive the AES key: key = XOR(atob(partB), maskBytes) (first 32 bytes)
function deriveAesKey(partB: string, maskHex: string): Buffer {
  const maskBytes = hexToBytes(maskHex);
  const partBBytes = Buffer.from(partB, "base64");
  if (partBBytes.length < 32) throw new Error("partB too short");
  const keyBytes = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = partBBytes[i] ^ maskBytes[i % maskBytes.length];
  }
  return keyBytes;
}

// Build the aaReq signed proof: base64([0x01][iv(12)][encrypted+tag])
function buildAaReq(
  queryHash: string,
  epoch: string,
  aesKey: Buffer,
  buildId: string,
): string {
  const ts = Math.floor(Date.now() / 300000) * 300000; // 5-min bucket
  const payload = JSON.stringify({ v: 1, ts, epoch, buildId, qh: queryHash });
  const ivSource = `${epoch}:${buildId}:${queryHash}:${ts}`;
  const ivHash = sha256(ivSource);
  const iv = ivHash.subarray(0, 12);

  const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const encryptedWithTag = Buffer.concat([encrypted, tag]);

  const result = Buffer.alloc(1 + 12 + encryptedWithTag.length);
  result[0] = 1;
  result.set(iv, 1);
  result.set(encryptedWithTag, 13);
  return result.toString("base64");
}

// Fetch window.__aaCrypto from mkissa.to episode page HTML
async function fetchAaCrypto(
  showId: string,
  episodeString: string,
  translationType: string,
): Promise<{ epoch: string; partB: string }> {
  const url = MKISSA_EPISODE_URL(showId, episodeString, translationType);
  const res = await fetch(url, {
    headers: {
      "User-Agent": MKISSA_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`mkissa.to returned HTTP ${res.status}`);
  }
  const html = await res.text();
  const match = html.match(/window\.__aaCrypto\s*=\s*(\{[^}]+\})/);
  if (!match) {
    throw new Error("__aaCrypto not found in mkissa.to page HTML");
  }
  const aaCrypto = JSON.parse(match[1]);
  if (!aaCrypto.partB || !aaCrypto.epoch) {
    throw new Error(`__aaCrypto missing required fields: ${JSON.stringify(aaCrypto)}`);
  }
  return aaCrypto;
}

// Decrypt tobeparsed (try new key first, fall back to OLD sha256("Xot36i3lK3:v1"))
function decryptWithGcm(b64: string, newKey: Buffer): unknown | null {
  try {
    const bytes = Buffer.from(b64, "base64");
    if (bytes.length < 32 || bytes[0] !== 1) return null;
    const iv = bytes.subarray(1, 13);
    const ctWithTag = bytes.subarray(13);
    const ciphertext = ctWithTag.subarray(0, ctWithTag.length - 16);
    const tag = ctWithTag.subarray(ctWithTag.length - 16);

    // Try NEW key first (mkissa.to's primary path)
    try {
      const decipher = createDecipheriv("aes-256-gcm", newKey, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(plaintext.toString("utf-8"));
    } catch {
      // fall through to old key
    }

    // Fallback: OLD key
    try {
      const decipher = createDecipheriv("aes-256-gcm", getOldKey(), iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(plaintext.toString("utf-8"));
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

// ─── Runtime MASK/BUILD_ID discovery (self-healing) ───────────────────────
// Crawls mkissa.to's SvelteKit bundle at runtime to find the current MASK
// and BUILD_ID. Called automatically when AllAnime returns AA_CRYPTO_STALE,
// so we self-heal without needing a code update on every mkissa.to deploy.
//
// Robust pattern matching for MASK and BUILD_ID.
// mkissa.to's minifier changes the exact shape of these assignments across builds.
// Observed shapes:
//   Build A: const $n=_t(460)!=='string'?"<MASK_HEX>":"",zr="9"
//   Build B: const $n=_t(460)!=='string'?"<MASK_HEX>":"",zr="13"
//   Build C: const Ju="<MASK_HEX>",sr=_t(483)!=='string'?"20":""
//
// Strategy:
//   1. Find the ONLY 64-hex string literal in the chunk → that's the MASK
//   2. Find buildId:<var> or x-build-id":<var> → that var holds the BUILD_ID
//   3. Look up that var's assignment: either <var>="<N>" or
//      <var>=_t(N)!=='string'?"<N>":""  → extract the number

const HEX_64_PATTERN = /"([0-9a-fA-F]{64})"/;
const BUILD_ID_REF_PATTERN = /(?:buildId|x-build-id")\s*:\s*([A-Za-z_$][\w$]*)/g;

function makeBuildIdDirectPattern(varName: string): RegExp {
  const v = varName.replace(/\$/g, "\\$");
  return new RegExp("(?:const|var|let|,)\\s*" + v + '\\s*=\\s*"(\\d{1,3})"');
}

function makeBuildIdWrappedPattern(varName: string): RegExp {
  const v = varName.replace(/\$/g, "\\$");
  return new RegExp(
    v + '\\s*=\\s*[A-Za-z_$][\\w$]*\\(\\s*\\d+\\s*\\)\\s*!==\\s*"string"\\s*\\?\\s*"(\\d{1,3})"',
  );
}

function extractMaskAndBuildId(
  src: string,
): { mask: string; buildId: string | null } | null {
  // 1. Find the (only) 64-hex string literal
  const hexMatch = src.match(HEX_64_PATTERN);
  if (!hexMatch) return null;
  const mask = hexMatch[1];

  // 2. Find all buildId:<var> references and collect candidate values
  const buildIdRefs = [...src.matchAll(BUILD_ID_REF_PATTERN)];
  if (buildIdRefs.length === 0) return { mask, buildId: null };

  const candidates: string[] = [];
  const seenVars = new Set<string>();
  for (const ref of buildIdRefs) {
    const varName = ref[1];
    if (seenVars.has(varName)) continue;
    seenVars.add(varName);

    // Try direct assignment first: <var>="<N>"
    const directMatch = src.match(makeBuildIdDirectPattern(varName));
    if (directMatch) {
      candidates.push(directMatch[1]);
      continue;
    }

    // Try wrapped assignment: <var>=_t(N)!=='string'?"<N>":""
    const wrappedMatch = src.match(makeBuildIdWrappedPattern(varName));
    if (wrappedMatch) {
      candidates.push(wrappedMatch[1]);
    }
  }

  if (candidates.length === 0) return { mask, buildId: null };

  // Pick the most common candidate
  const counts: Record<string, number> = {};
  for (const c of candidates) counts[c] = (counts[c] || 0) + 1;
  const buildId = candidates.sort((a, b) => counts[b] - counts[a])[0];

  return { mask, buildId };
}

function resolveChunkUrl(rel: string, baseUrl: string): string {
  if (rel.startsWith("http://") || rel.startsWith("https://")) return rel;
  const clean = rel.split("?")[0].split("#")[0];
  let baseDir = baseUrl.slice(0, baseUrl.lastIndexOf("/"));
  let r = clean;
  while (r.startsWith("../")) {
    baseDir = baseDir.slice(0, baseDir.lastIndexOf("/"));
    r = r.slice(3);
  }
  if (r.startsWith("./")) r = r.slice(2);
  return `${baseDir}/${r}`;
}

async function discoverMaskFromMkissa(): Promise<{ mask: string; buildId: string }> {
  // Step 1: Fetch landing page
  const htmlRes = await fetch(MKISSA_ORIGIN, {
    headers: {
      "User-Agent": MKISSA_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!htmlRes.ok) throw new Error(`mkissa.to returned HTTP ${htmlRes.status}`);
  const html = await htmlRes.text();

  // Step 2: Extract entry chunk URLs from `import("...")` calls
  const entryUrlMatches = [...html.matchAll(/import\(\s*"([^"]+\.js)"\s*\)/g)];
  const entryUrls = entryUrlMatches
    .map((m) => m[1])
    .filter((u) => u.includes("/_app/immutable/entry/"));
  if (entryUrls.length === 0) {
    throw new Error("no entry chunk URLs found in mkissa.to HTML");
  }

  // Step 3: BFS crawl — fetch chunks at increasing depths, searching each for
  // the MASK pattern and collecting new chunk URLs to crawl next.
  const MAX_CHUNKS_TO_CRAWL = 40;
  const visited = new Set<string>();
  const queue = [...entryUrls];
  let crawlCount = 0;

  while (queue.length > 0 && crawlCount < MAX_CHUNKS_TO_CRAWL) {
    const batch = queue.splice(0, Math.min(queue.length, 10));
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        if (visited.has(url)) return { found: null as null | { mask: string; buildId: string; chunkUrl: string }, newUrls: [] as string[] };
        visited.add(url);
        crawlCount++;
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": MKISSA_UA, Accept: "*/*" },
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) return { found: null, newUrls: [] };
          const src = await res.text();

          const extracted = extractMaskAndBuildId(src);
          if (extracted && extracted.buildId) {
            return {
              found: {
                mask: extracted.mask,
                buildId: extracted.buildId,
                chunkUrl: url,
              },
              newUrls: [],
            };
          }

          const newUrls: string[] = [];
          for (const m of src.matchAll(/import\(\s*"([^"]+\.js)"\s*\)/g)) {
            const abs = resolveChunkUrl(m[1], url);
            if (abs.includes("/_app/immutable/chunks/") && !visited.has(abs)) {
              newUrls.push(abs);
            }
          }
          for (const m of src.matchAll(/from\s*"([^"]+\.js)"/g)) {
            const abs = resolveChunkUrl(m[1], url);
            if (abs.includes("/_app/immutable/chunks/") && !visited.has(abs)) {
              newUrls.push(abs);
            }
          }
          return { found: null, newUrls };
        } catch {
          return { found: null, newUrls: [] };
        }
      }),
    );

    const found = batchResults.find((r) => r.found !== null);
    if (found && found.found) {
      console.log(
        `[allanime-crypto] ✓ discovered MASK=${found.found.mask.slice(0, 16)}... BUILD_ID=${found.found.buildId} from ${found.found.chunkUrl.split("/").pop()} (crawled ${crawlCount} chunks)`,
      );
      return { mask: found.found.mask, buildId: found.found.buildId };
    }

    for (const r of batchResults) {
      for (const u of r.newUrls) {
        if (!visited.has(u) && !queue.includes(u)) {
          queue.push(u);
        }
      }
    }
  }

  throw new Error(
    `MASK/BUILD_ID not found after crawling ${crawlCount} chunks — pattern shape may have changed`,
  );
}

// Returns the current MASK/BUILD_ID, preferring cached discovered values,
// falling back to hardcoded constants.
async function getMaskAndBuildId(): Promise<{
  mask: string;
  buildId: string;
  source: "discovered" | "fallback";
}> {
  if (discoveredCrypto && discoveredCrypto.expiresAt > Date.now()) {
    return {
      mask: discoveredCrypto.mask,
      buildId: discoveredCrypto.buildId,
      source: "discovered",
    };
  }
  return {
    mask: FALLBACK_MASK_HEX,
    buildId: FALLBACK_BUILD_ID,
    source: "fallback",
  };
}

// Force a fresh discovery. Called when AA_CRYPTO_STALE happens.
async function refreshMaskAndBuildId(): Promise<void> {
  discoveredCrypto = null;
  try {
    const discovered = await discoverMaskFromMkissa();
    discoveredCrypto = {
      mask: discovered.mask,
      buildId: discovered.buildId,
      expiresAt: Date.now() + DISCOVERED_CACHE_TTL_MS,
    };
  } catch (e) {
    console.warn(
      `[allanime-crypto] mask discovery failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

// ─── In-memory caches ─────────────────────────────────────────
interface CachedSource {
  sources: SourceUrl[];
  expiresAt: number;
}
const responseCache = new Map<string, CachedSource>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key: string): SourceUrl[] | null {
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.sources;
  if (cached) responseCache.delete(key);
  return null;
}

function setCached(key: string, sources: SourceUrl[]) {
  responseCache.set(key, { sources, expiresAt: Date.now() + CACHE_TTL_MS });
  if (responseCache.size > 100) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
}

// Cache for __aaCrypto + derived AES key (1 hour TTL — refreshes on AA_CRYPTO_STALE)
const AA_CRYPTO_CACHE_TTL_MS = 60 * 60 * 1000;
let aaCryptoCache: {
  aaCrypto: { epoch: string; partB: string };
  aesKey: Buffer;
  expiresAt: number;
} | null = null;

async function getAaCryptoAndKey(
  showId: string,
  episodeString: string,
  translationType: string,
) {
  if (aaCryptoCache && aaCryptoCache.expiresAt > Date.now()) {
    return aaCryptoCache;
  }
  const aaCrypto = await fetchAaCrypto(showId, episodeString, translationType);
  const { mask } = await getMaskAndBuildId();
  const aesKey = deriveAesKey(aaCrypto.partB, mask);
  aaCryptoCache = {
    aaCrypto,
    aesKey,
    expiresAt: Date.now() + AA_CRYPTO_CACHE_TTL_MS,
  };
  return aaCryptoCache;
}

// ─── Episode query (exact fields mkissa.to expects) ───────────
// The server rejects smaller queries with "Cannot set properties of undefined"
const EPISODE_QUERY = `query(
$showId: String!
$translationType: VaildTranslationTypeEnumType!
$episodeString: String!
) {
episode(
showId: $showId
translationType: $translationType
episodeString: $episodeString
) {
episodeString
uploadDate
sourceUrls
thumbnail
notes
show{
_id
name
englishName
nativeName
slugTime
thumbnail
lastEpisodeInfo
lastEpisodeDate
type
season
score
airedStart
availableEpisodes
episodeDuration
episodeCount
lastUpdateEnd
characterCount
description
broadcastInterval
banner
characters
availableEpisodesDetail
nameOnlyString
isAdult
relatedShows
relatedMangas
altNames
disqusIds
}
pageStatus{
_id
notes
pageId
showId
views
likesCount
commentCount
dislikesCount
reviewCount
userScoreCount
userScoreTotalValue
userScoreAverValue
}
episodeInfo{
notes
thumbnails
vidInforssub
uploadDates
vidInforsdub
vidInforsraw
description
}
versionFix
}
}`;

// ─── Main resolver ────────────────────────────────────────────
export async function fetchAllAnimeEpisodeDirect(
  showId: string,
  episodeString: string,
  translationType: "sub" | "dub",
): Promise<EpisodeResolveResult> {
  const cacheKey = `${showId}:${episodeString}:${translationType}`;

  const cached = getCached(cacheKey);
  if (cached) {
    return { sources: cached, cached: true, error: undefined };
  }

  try {
    // Step 1: Get __aaCrypto from mkissa.to + derive AES key
    const { aaCrypto, aesKey } = await getAaCryptoAndKey(
      showId,
      episodeString,
      translationType,
    );

    // Step 2: Compute query hash
    const queryHash = sha256Hex(EPISODE_QUERY);

    // Step 3: Build aaReq signed proof
    const maskState = await getMaskAndBuildId();
    const aaReq = buildAaReq(queryHash, aaCrypto.epoch, aesKey, maskState.buildId);

    // Step 4: POST to api.allanime.day/api with the signed request
    const body = {
      query: EPISODE_QUERY,
      variables: { showId, episodeString, translationType },
      extensions: {
        persistedQuery: { version: 1, sha256Hash: queryHash },
        aaReq,
      },
    };

    const res = await fetch(ALLANIME_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": MKISSA_UA,
        Referer: "https://mkissa.to/",
        Origin: "https://mkissa.to",
        "x-build-id": maskState.buildId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        sources: null,
        error: `AllAnime API HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const json: Record<string, unknown> = await res.json();

    if (json.errors && (json.errors as Array<Record<string, unknown>>)[0]) {
      const err = (json.errors as Array<Record<string, unknown>>)[0];
      const errCode = (err.extensions as { code?: string })?.code ?? "";
      const errMsg = (err.message as string) ?? "Unknown error";

      // Self-heal trigger: retry on AA_CRYPTO* errors (explicit crypto rejection)
      // OR on ANY error if we're currently using FALLBACK values (which may be stale).
      const currentSource = maskState.source;
      const shouldSelfHeal =
        errCode.startsWith("AA_CRYPTO") || currentSource === "fallback";

      if (shouldSelfHeal) {
        console.warn(
          `[allanime-crypto] ${errCode} (source=${currentSource}) — refreshing __aaCrypto AND MASK/BUILD_ID, then retrying...`,
        );
        aaCryptoCache = null;
        await refreshMaskAndBuildId();
        const fresh = await getMaskAndBuildId();
        console.log(
          `[allanime-crypto] using ${fresh.source} MASK=${fresh.mask.slice(0, 16)}... BUILD_ID=${fresh.buildId}`,
        );

        // Optimization: if discovery returned the SAME values we were already using,
        // the error is NOT a crypto issue. Skip the retry.
        if (
          currentSource === "fallback" &&
          fresh.source === "discovered" &&
          fresh.mask === maskState.mask &&
          fresh.buildId === maskState.buildId
        ) {
          console.log(
            "[allanime-crypto] discovered values match fallback — error is not crypto-related, skipping retry",
          );
        } else {
          // Re-fetch fresh __aaCrypto + re-derive key + re-sign + retry the API call
          const freshCrypto = await getAaCryptoAndKey(
            showId,
            episodeString,
            translationType,
          );
          const freshAaReq = buildAaReq(
            queryHash,
            freshCrypto.aaCrypto.epoch,
            freshCrypto.aesKey,
            fresh.buildId,
          );

          const retryRes = await fetch(ALLANIME_API, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "User-Agent": MKISSA_UA,
              Referer: "https://mkissa.to/",
              Origin: "https://mkissa.to",
              "x-build-id": fresh.buildId,
            },
            body: JSON.stringify({
              query: EPISODE_QUERY,
              variables: { showId, episodeString, translationType },
              extensions: {
                persistedQuery: { version: 1, sha256Hash: queryHash },
                aaReq: freshAaReq,
              },
            }),
            signal: AbortSignal.timeout(15_000),
          });

          if (retryRes.ok) {
            const retryJson: Record<string, unknown> = await retryRes.json();
            if (!retryJson.errors) {
              const retryData = retryJson.data as
                | { tobeparsed?: string; episode?: { sourceUrls?: SourceUrl[] } }
                | undefined;
              if (retryData?.tobeparsed) {
                const decrypted = decryptWithGcm(
                  retryData.tobeparsed,
                  freshCrypto.aesKey,
                ) as { episode?: { sourceUrls?: SourceUrl[] } } | null;
                const sources = decrypted?.episode?.sourceUrls ?? [];
                if (sources.length > 0) {
                  setCached(cacheKey, sources);
                  return { sources, cached: false, error: undefined };
                }
              }
              if (retryData?.episode?.sourceUrls) {
                const sources = retryData.episode.sourceUrls;
                setCached(cacheKey, sources);
                return { sources, cached: false, error: undefined };
              }
            }
          }

          return {
            sources: null,
            error: `AllAnime GraphQL: ${errMsg} (${errCode}) — retry also failed`,
          };
        }
      }

      return { sources: null, error: `AllAnime GraphQL: ${errMsg} (${errCode})` };
    }

    // Step 5: Decrypt tobeparsed (try new key, fall back to old)
    const data = json.data as
      | { tobeparsed?: string; episode?: { sourceUrls?: SourceUrl[] } }
      | undefined;

    if (data?.tobeparsed) {
      const decrypted = decryptWithGcm(data.tobeparsed, aesKey) as
        | { episode?: { sourceUrls?: SourceUrl[] } }
        | null;
      const sources = decrypted?.episode?.sourceUrls ?? [];
      if (sources.length === 0) {
        return { sources: null, error: "tobeparsed decrypted but no sourceUrls" };
      }
      setCached(cacheKey, sources);
      return { sources, cached: false, error: undefined };
    }

    if (data?.episode?.sourceUrls) {
      const sources = data.episode.sourceUrls;
      setCached(cacheKey, sources);
      return { sources, cached: false, error: undefined };
    }

    return { sources: null, error: "No sourceUrls in response" };
  } catch (err) {
    return {
      sources: null,
      error: `Direct crypto failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
