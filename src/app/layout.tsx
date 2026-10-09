import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Querétaro Romance AI",
  description: "PoC para la Secretaría de Turismo del Estado de Querétaro.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
