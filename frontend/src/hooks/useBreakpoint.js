// src/hooks/useBreakpoint.js
import { useState, useEffect } from "react";

const BREAKPOINTS = {
  xs:  375,
  sm:  480,
  md:  768,
  lg:  1024,
  xl:  1280,
};

export function useBreakpoint() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const fn = () => setWidth(window.innerWidth);
    window.addEventListener("resize", fn, { passive: true });
    return () => window.removeEventListener("resize", fn);
  }, []);

  return {
    width,
    isXs:     width <= BREAKPOINTS.xs,   // ≤ 375 — küçük telefon
    isSm:     width <= BREAKPOINTS.sm,   // ≤ 480 — telefon
    isMd:     width <= BREAKPOINTS.md,   // ≤ 768 — tablet/büyük telefon
    isLg:     width <= BREAKPOINTS.lg,   // ≤ 1024 — küçük masaüstü
    isMobile: width <= BREAKPOINTS.md,   // kısayol
    isTablet: width > BREAKPOINTS.md && width <= BREAKPOINTS.lg,
    isDesktop: width > BREAKPOINTS.lg,
  };
}