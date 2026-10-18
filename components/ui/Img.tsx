"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";

/** <img> that swaps to a fallback (or nothing) if the file can't load. */
export function Img({ fallback = null, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fallback?: ReactNode }) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // A server-rendered <img> can fail before React hydrates and attaches onError.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0 && el.currentSrc) setBroken(true);
  }, []);
  if (broken) return <>{fallback}</>;
  return <img alt="" {...props} ref={ref} onError={() => setBroken(true)} />;
}
