/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export function Logo({ size = 32, href = "/", text = true }: { size?: number; href?: string | null; text?: boolean }) {
  const inner = (
    <>
      <img src="/brand/logo-mark.png" alt="" width={size} height={size} />
      {text && <span>Dabber</span>}
    </>
  );
  if (!href) return <span className="brand">{inner}</span>;
  return (
    <Link href={href} className="brand" aria-label="Dabber home">
      {inner}
    </Link>
  );
}
