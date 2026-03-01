import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coki — Personal Assistant",
  description: "Your AI-powered personal assistant, accessible via WhatsApp and dashboard.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0d0f14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
