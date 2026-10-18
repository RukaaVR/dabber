import type { Metadata, Viewport } from "next";
import { THEME_BOOT_SCRIPT } from "@/lib/client/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dabber",
  description: "Chat, servers, voice and screen sharing with your people. Free.",
  applicationName: "Dabber",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Dabber", statusBarStyle: "black" },
  openGraph: {
    title: "Dabber",
    description: "Chat, servers, voice and screen sharing with your people. Free.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Dabber" }],
  },
  twitter: { card: "summary_large_image", title: "Dabber", images: ["/og.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#121318",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
