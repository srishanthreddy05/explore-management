"use client";

import { useEffect } from "react";

/**
 * Globally prevents mouse-wheel from changing number input values.
 * Mounted once at the root layout level.
 */
export function NoScrollNumbers() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" && (el as HTMLInputElement).type === "number") {
        e.preventDefault();
        el.blur();
      }
    };

    // Use capture phase so it fires before React handlers
    document.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => {
      document.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, []);

  return null;
}
