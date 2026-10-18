"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, type ImgHTMLAttributes, type ReactNode } from "react";

/** <img> that swaps to a fallback (or nothing) if the file can't load. */
export function Img({ fallback = null, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fallback?: ReactNode }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <>{fallback}</>;
  return <img alt="" {...props} onError={() => setBroken(true)} />;
}
