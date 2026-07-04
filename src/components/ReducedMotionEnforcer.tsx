"use client";

// components/ReducedMotionEnforcer.tsx
// ✅ Applies the `xan-reduce-motion` class to <html> when the effective
//    reduced-motion preference is true. The class is targeted in
//    globals.css to disable animations globally.

import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function ReducedMotionEnforcer() {
  const reduce = useReducedMotion();

  useEffect(() => {
    const root = document.documentElement;
    if (reduce) {
      root.classList.add("xan-reduce-motion");
    } else {
      root.classList.remove("xan-reduce-motion");
    }
  }, [reduce]);

  return null;
}
