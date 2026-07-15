"use client";

// components/layout/BackButton.tsx
// ✅ Tiny client-side back button — uses browser history, falls back to /home.

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  fallback?: string;
  className?: string;
  label?: string;
}

export function BackButton({
  fallback = "/home",
  className,
  label = "Back",
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    // If there's history, go back; otherwise navigate to fallback.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button
      onClick={handleBack}
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
