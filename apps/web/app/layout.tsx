import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-store";

export const metadata: Metadata = {
  title: "AI Creative Hub",
  description: "AI Creative Hub — ijodiy g'oyalarni AI yordamida yaratish platformasi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}