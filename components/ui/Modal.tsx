"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Accessible modal: focus trap, Esc to close, click backdrop to close. */
export function Modal({
  onClose,
  title,
  sub,
  children,
  foot,
  size,
  center,
  labelledBy = "modal-title",
}: {
  onClose: () => void;
  title?: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  foot?: ReactNode;
  size?: "wide" | "xwide";
  center?: boolean;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("[autofocus], input, textarea, select, button:not(.modal-x)");
    (first ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === "Tab" && el) {
        const f = [...el.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
          (x) => !x.hasAttribute("disabled") && x.offsetParent !== null,
        );
        if (!f.length) return;
        const a = f[0];
        const b = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, []);

  return (
    <div className="overlay sheet-mobile" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal${size ? ` ${size}` : ""}`} role="dialog" aria-modal="true" aria-labelledby={title ? labelledBy : undefined} tabIndex={-1}>
        {title && (
          <div className={`modal-head${center ? " center" : ""}`}>
            <h2 id={labelledBy}>{title}</h2>
            {sub && <p>{sub}</p>}
            <button className="icon-btn modal-x" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        )}
        {children}
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}
