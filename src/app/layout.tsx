import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/Nav";
import { SessionProvider } from "@/store/SessionContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Group Photo Planner",
  description:
    "Operations tool for arranging large school group photographs quickly and repeatably.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <SessionProvider>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
