// app/(app)/browse/page.tsx
// Server Component — wraps BrowseClient in Suspense for useSearchParams
import { Suspense } from "react";
import { BrowseClient } from "./BrowseClient";

export const dynamic = "force-dynamic";

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
          <div className="h-12 rounded-full bg-xan-card animate-shimmer mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] rounded-xl bg-xan-card animate-shimmer"
              />
            ))}
          </div>
        </div>
      }
    >
      <BrowseClient />
    </Suspense>
  );
}
