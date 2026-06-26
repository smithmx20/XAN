"use client";

// app/(app)/settings/page.tsx
// ✅ Completely redesigned settings page — no cf_clearance UI.
// ✅ Six sections: Appearance, Playback, Audio & Subtitles,
//    Content & Discovery, Data & Privacy, About.
// ✅ Persists via useSettings hook (localStorage "xan-settings").
// ✅ Theme switching wired through next-themes.
// ✅ Clear / Export watch history wired through useWatchHistory.

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  Palette,
  Play,
  Languages,
  ShieldCheck,
  Database,
  Info,
  Moon,
  Sun,
  Monitor,
  Gauge,
  Volume2,
  SkipForward,
  SkipBack,
  EyeOff,
  Sparkles,
  Trash2,
  Download,
  RotateCcw,
  Heart,
  Github,
  ExternalLink,
  Check,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSettings, DEFAULT_SETTINGS, type Settings } from "@/hooks/useSettings";
import { useWatchHistory } from "@/hooks/useWatchHistory";

// ─── Section definitions (for nav chips + rendering) ───────────────────────

type SectionId =
  | "appearance"
  | "playback"
  | "audio"
  | "content"
  | "data"
  | "about";

const SECTIONS: { id: SectionId; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "playback", label: "Playback", icon: Play },
  { id: "audio", label: "Audio & Subtitles", icon: Languages },
  { id: "content", label: "Content & Discovery", icon: ShieldCheck },
  { id: "data", label: "Data & Privacy", icon: Database },
  { id: "about", label: "About", icon: Info },
];

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SORT_OPTIONS: { value: Settings["defaultSort"]; label: string }[] = [
  { value: "trending", label: "Trending now" },
  { value: "popular", label: "All-time popular" },
  { value: "score", label: "Highest score" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings, update, reset, isLoaded } = useSettings();
  const { theme, setTheme } = useTheme();
  const { history, clearHistory } = useWatchHistory();
  const [activeSection, setActiveSection] = useState<SectionId>("appearance");
  const [exported, setExported] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Scroll spy: highlight nav chip for the section currently in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          setActiveSection(visible.target.id as SectionId);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isLoaded]);

  const handleExport = useCallback(() => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        history,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xan-history-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExported(true);
      setTimeout(() => setExported(false), 2000);
    } catch {
      // ignore
    }
  }, [history]);

  const historyCount = useMemo(() => history.length, [history]);

  // Don't render interactive controls until hydrated — prevents flash of wrong values
  if (!isLoaded) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <div className="h-24 rounded-xl bg-xan-card/30 animate-pulse" />
        <div className="h-10 rounded-lg bg-xan-card/30 animate-pulse" />
        <div className="h-64 rounded-xl bg-xan-card/30 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
      {/* ─── Header ─── */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground flex items-center gap-3">
          <span className="bg-gradient-to-r from-xan-crimson to-xan-violet bg-clip-text text-transparent">
            Settings
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Personalize your XAN streaming experience. Changes are saved
          automatically to your browser.
        </p>
      </div>

      {/* ─── Section nav chips (sticky) ─── */}
      <nav className="sticky top-16 z-20 -mx-4 px-4 py-2 bg-background/80 backdrop-blur-md border-b border-xan-border">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const active = activeSection === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  active
                    ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white shadow-lg shadow-xan-crimson/20"
                    : "bg-xan-card/60 text-muted-foreground hover:text-foreground hover:bg-xan-card-hover border border-xan-border"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </a>
            );
          })}
        </div>
      </nav>

      {/* ─── Appearance ─── */}
      <section id="appearance" className="scroll-mt-32">
        <SectionHeader
          icon={Palette}
          title="Appearance"
          description="Customize how XAN looks on your device."
        />
        <Card className="border-xan-border bg-xan-card/40 backdrop-blur-sm">
          <CardContent className="p-6 space-y-6">
            <SettingRow
              icon={theme === "dark" ? Moon : theme === "light" ? Sun : Monitor}
              title="Theme"
              description="Choose between dark, light, or follow your system preference."
            >
              <div className="flex gap-1.5 bg-xan-card/60 p-1 rounded-lg border border-xan-border">
                {(
                  [
                    { value: "dark", icon: Moon, label: "Dark" },
                    { value: "light", icon: Sun, label: "Light" },
                    { value: "system", icon: Monitor, label: "Auto" },
                  ] as const
                ).map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setTheme(value);
                      update("theme", value);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      theme === value
                        ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </SettingRow>
          </CardContent>
        </Card>
      </section>

      {/* ─── Playback ─── */}
      <section id="playback" className="scroll-mt-32">
        <SectionHeader
          icon={Play}
          title="Playback"
          description="Control how episodes play by default."
        />
        <Card className="border-xan-border bg-xan-card/40 backdrop-blur-sm">
          <CardContent className="p-6 space-y-6 divide-y divide-xan-border/60">
            <SettingRow
              icon={SkipForward}
              title="Autoplay next episode"
              description="Automatically queue and play the next episode when the current one ends."
            >
              <Switch
                checked={settings.autoplayNext}
                onCheckedChange={(v) => update("autoplayNext", v)}
              />
            </SettingRow>

            <SettingRow
              icon={RotateCcw}
              title="Auto-resume from last position"
              description="When revisiting an episode, jump to where you left off."
            >
              <Switch
                checked={settings.autoResume}
                onCheckedChange={(v) => update("autoResume", v)}
              />
            </SettingRow>

            <SettingRow
              icon={Gauge}
              title="Default playback speed"
              description="Start every episode at this speed. You can still adjust during playback."
            >
              <Select
                value={String(settings.defaultPlaybackSpeed)}
                onValueChange={(v) => update("defaultPlaybackSpeed", parseFloat(v))}
              >
                <SelectTrigger className="w-28 bg-xan-card border-xan-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAYBACK_SPEEDS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s === 1 ? "1× (Normal)" : `${s}×`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            <div className="pt-6 space-y-3">
              <SettingRow
                icon={Volume2}
                title="Default volume"
                description="Start every episode at this volume level."
                stacked
              >
                <div className="flex items-center gap-3 w-full">
                  <Slider
                    value={[settings.defaultVolume]}
                    onValueChange={(v) => update("defaultVolume", v[0] ?? 100)}
                    min={0}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                    {settings.defaultVolume}%
                  </span>
                </div>
              </SettingRow>
            </div>

            <SettingRow
              icon={SkipBack}
              title="Auto-skip intro"
              description="Skip the opening theme (first ~85 seconds) automatically."
            >
              <Switch
                checked={settings.skipIntro}
                onCheckedChange={(v) => update("skipIntro", v)}
              />
            </SettingRow>

            <SettingRow
              icon={SkipForward}
              title="Auto-skip outro"
              description="Skip the ending theme automatically when it starts."
            >
              <Switch
                checked={settings.skipOutro}
                onCheckedChange={(v) => update("skipOutro", v)}
              />
            </SettingRow>
          </CardContent>
        </Card>
      </section>

      {/* ─── Audio & Subtitles ─── */}
      <section id="audio" className="scroll-mt-32">
        <SectionHeader
          icon={Languages}
          title="Audio & Subtitles"
          description="Pick your preferred audio track by default."
        />
        <Card className="border-xan-border bg-xan-card/40 backdrop-blur-sm">
          <CardContent className="p-6 space-y-6">
            <SettingRow
              icon={Languages}
              title="Default audio mode"
              description="Choose SUB (Japanese audio + English subtitles) or DUB (English dubbed audio). You can still switch during playback."
            >
              <div className="flex gap-1.5 bg-xan-card/60 p-1 rounded-lg border border-xan-border">
                {(["sub", "dub"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => update("defaultAudioMode", mode)}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                      settings.defaultAudioMode === mode
                        ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "sub" ? "SUB" : "DUB"}
                  </button>
                ))}
              </div>
            </SettingRow>
          </CardContent>
        </Card>
      </section>

      {/* ─── Content & Discovery ─── */}
      <section id="content" className="scroll-mt-32">
        <SectionHeader
          icon={ShieldCheck}
          title="Content & Discovery"
          description="Filter what shows up while browsing."
        />
        <Card className="border-xan-border bg-xan-card/40 backdrop-blur-sm">
          <CardContent className="p-6 space-y-6 divide-y divide-xan-border/60">
            <SettingRow
              icon={EyeOff}
              title="Hide adult content"
              description="Filter out Ecchi, Erotica, and Hentai titles from search, browse, and recommendations."
            >
              <Switch
                checked={settings.hideAdult}
                onCheckedChange={(v) => update("hideAdult", v)}
              />
            </SettingRow>

            <SettingRow
              icon={Sparkles}
              title="Hide spoilers in descriptions"
              description="Blur spoiler-sensitive text in anime synopses until you hover over them."
            >
              <Switch
                checked={settings.hideSpoilers}
                onCheckedChange={(v) => update("hideSpoilers", v)}
              />
            </SettingRow>

            <SettingRow
              icon={ChevronRight}
              title="Default sort order"
              description="Default sort for trending, popular, and browse pages."
            >
              <Select
                value={settings.defaultSort}
                onValueChange={(v) =>
                  update("defaultSort", v as Settings["defaultSort"])
                }
              >
                <SelectTrigger className="w-44 bg-xan-card border-xan-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
          </CardContent>
        </Card>
      </section>

      {/* ─── Data & Privacy ─── */}
      <section id="data" className="scroll-mt-32">
        <SectionHeader
          icon={Database}
          title="Data & Privacy"
          description="Manage what XAN stores on your device."
        />
        <Card className="border-xan-border bg-xan-card/40 backdrop-blur-sm">
          <CardContent className="p-6 space-y-6 divide-y divide-xan-border/60">
            <SettingRow
              icon={Database}
              title="Save watch history"
              description="Track episodes you've watched locally for 'Continue Watching' and progress bars. Disabling this stops new entries from being saved."
            >
              <Switch
                checked={settings.saveHistory}
                onCheckedChange={(v) => update("saveHistory", v)}
              />
            </SettingRow>

            <div className="pt-6 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                    Clear watch history
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete all {historyCount}{" "}
                    {historyCount === 1 ? "entry" : "entries"} from your watch
                    history. This cannot be undone.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={historyCount === 0}
                      className="bg-xan-card border-xan-border hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 flex-shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Clear
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-xan-card border-xan-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Clear all watch history?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {historyCount}{" "}
                        {historyCount === 1 ? "entry" : "entries"} including
                        progress timestamps. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-xan-card border-xan-border">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={clearHistory}
                        className="bg-red-500 hover:bg-red-600 text-white border-0"
                      >
                        Yes, clear everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <div className="pt-6 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    Export watch history
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Download your watch history as a JSON file for backup or
                    transfer.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExport}
                  disabled={historyCount === 0}
                  className="bg-xan-card border-xan-border hover:bg-xan-card-hover flex-shrink-0"
                >
                  {exported ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                      Downloaded
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Export
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ─── About ─── */}
      <section id="about" className="scroll-mt-32">
        <SectionHeader
          icon={Info}
          title="About"
          description="Version info, source, and credits."
        />
        <Card className="border-xan-border bg-xan-card/40 backdrop-blur-sm overflow-hidden">
          <div className="bg-gradient-to-br from-xan-crimson/10 via-transparent to-xan-violet/10 p-6 border-b border-xan-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-xan-crimson/30">
                X
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-display font-bold text-foreground">
                    XAN
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-xan-card/60 border border-xan-border text-muted-foreground font-mono">
                    v1.0.0
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Stream anime without the noise.
                </p>
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              XAN is a modern anime streaming web app built with Next.js 16,
              TypeScript, Tailwind CSS v4, and shadcn/ui. Powered by AniList for
              metadata and AllAnime for streams. All preferences are stored
              locally in your browser — no account, no tracking, no servers
              knowing what you watch.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="bg-xan-card border-xan-border hover:bg-xan-card-hover"
              >
                <a
                  href="https://github.com/sundeepyt2/XAN"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Github className="h-3.5 w-3.5 mr-1.5" />
                  Source code
                  <ExternalLink className="h-3 w-3 ml-1.5 text-muted-foreground" />
                </a>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="bg-xan-card border-xan-border hover:bg-xan-card-hover"
              >
                <a
                  href="https://anilist.co"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Heart className="h-3.5 w-3.5 mr-1.5 text-xan-crimson" />
                  Powered by AniList
                  <ExternalLink className="h-3 w-3 ml-1.5 text-muted-foreground" />
                </a>
              </Button>
            </div>

            <div className="pt-4 mt-2 border-t border-xan-border">
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                <strong className="text-muted-foreground">Disclaimer:</strong>{" "}
                XAN is for educational purposes only and does not host or stream
                any content itself. All streaming is performed via third-party
                APIs. Users are responsible for complying with their local laws
                and the terms of service of any third-party APIs used.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ─── Reset all settings ─── */}
      <div className="pt-4 border-t border-xan-border">
        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-red-400 hover:bg-red-500/5"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset all settings to defaults
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-xan-card border-xan-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Reset all settings?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will restore all settings to their default values. Your
                watch history will not be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-xan-card border-xan-border">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  reset();
                  setTheme(DEFAULT_SETTINGS.theme);
                }}
                className="bg-xan-crimson hover:bg-xan-crimson/90 text-white border-0"
              >
                Yes, reset to defaults
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ─── Helper components ──────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Palette;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-xan-crimson/20 to-xan-violet/20 border border-xan-border flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-xan-crimson" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-display font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  description,
  children,
  stacked = false,
}: {
  icon: typeof Palette;
  title: string;
  description: string;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Label className="text-sm font-medium text-foreground">{title}</Label>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {children}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1 flex-1 min-w-0">
        <Label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          {title}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
