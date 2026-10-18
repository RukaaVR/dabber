"use client";

import { cloneElement, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";

type Side = "right" | "top" | "bottom";

/** Hover/focus tooltip rendered in a portal so it escapes scroll containers. */
export function Tip({ label, side = "top", children }: { label: string; side?: Side; children: ReactElement<Record<string, unknown>> }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (el: HTMLElement) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = el.getBoundingClientRect();
      if (side === "right") setPos({ x: r.right + 12, y: r.top + r.height / 2 });
      else if (side === "bottom") setPos({ x: r.left + r.width / 2, y: r.bottom + 8 });
      else setPos({ x: r.left + r.width / 2, y: r.top - 8 });
    }, 120);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  };

  const child = cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => show(e.currentTarget),
    onMouseLeave: hide,
    onFocus: (e: React.FocusEvent<HTMLElement>) => show(e.currentTarget),
    onBlur: hide,
    onClick: (e: React.MouseEvent) => {
      hide();
      (children.props.onClick as ((e: React.MouseEvent) => void) | undefined)?.(e);
    },
  });

  const style: React.CSSProperties =
    side === "right"
      ? { left: pos?.x, top: pos?.y, transform: "translateY(-50%)" }
      : side === "bottom"
        ? { left: pos?.x, top: pos?.y, transform: "translateX(-50%)" }
        : { left: pos?.x, top: pos?.y, transform: "translate(-50%, -100%)" };

  return (
    <>
      {child}
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="tooltip" role="tooltip" style={style}>
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}
