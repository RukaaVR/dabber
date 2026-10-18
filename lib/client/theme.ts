// Accent tints. The first color drives buttons/links, the second the secondary glow.
export const ACCENTS: Record<string, { label: string; a: string; b: string }> = {
  violet: { label: "Dab Violet", a: "#7b61ff", b: "#ff5fa2" },
  grape: { label: "Grape", a: "#9b5cf6", b: "#5ec8ff" },
  bubblegum: { label: "Bubblegum", a: "#ff5fa2", b: "#ffc857" },
  coral: { label: "Coral", a: "#ff6f59", b: "#ffb86b" },
  sunny: { label: "Sunny", a: "#e8a10c", b: "#ff7a59" },
  mint: { label: "Mint", a: "#1fbf8f", b: "#5aa9e6" },
  lagoon: { label: "Lagoon", a: "#14a3b8", b: "#7b61ff" },
  sky: { label: "Sky", a: "#3d8bff", b: "#7ee2a8" },
  forest: { label: "Forest", a: "#3f9d5c", b: "#c7e36b" },
  cherry: { label: "Cherry", a: "#e0304a", b: "#ff9ecb" },
  slate: { label: "Slate", a: "#6b7a99", b: "#a7b4cc" },
  neon: { label: "Neon", a: "#d63ef0", b: "#33e6ff" },
};

export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('dabber-theme')==='light'?'light':'dark';d.dataset.theme=t;var A=${JSON.stringify(
  Object.fromEntries(Object.entries(ACCENTS).map(([k, v]) => [k, [v.a, v.b]])),
)};var k=localStorage.getItem('dabber-accent');if(k&&A[k]){d.style.setProperty('--accent',A[k][0]);d.style.setProperty('--accent-2',A[k][1]);}var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='light'?'#e4e5ea':'#121318');}catch(e){}})();`;

export function applyTheme(theme: "dark" | "light", accent: string) {
  const d = document.documentElement;
  d.dataset.theme = theme;
  const a = ACCENTS[accent] ?? ACCENTS.violet;
  d.style.setProperty("--accent", a.a);
  d.style.setProperty("--accent-2", a.b);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#e4e5ea" : "#121318");
}

// Colors for letter avatars / server icons / default banners.
export const PALETTE = ["#7b61ff", "#ff5fa2", "#1fbf8f", "#e8a10c", "#3d8bff", "#ff6f59"];

export function colorFor(seed: string | number): string {
  if (typeof seed === "number") return PALETTE[Math.abs(seed) % PALETTE.length];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return [...words[0]].slice(0, 2).join("");
  return words
    .slice(0, 3)
    .map((w) => [...w][0])
    .join("");
}
