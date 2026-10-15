import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppShell } from "@/components/shell/app-shell";
import { themeInitScript } from "@/store/theme-store";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Vijayagiri Ops Hub", template: "%s · Vijayagiri Ops Hub" },
  icons: {
    // The bike emblem from the official Vijayagiri logo, on a white tile so it reads on light and dark browser tabs.
    icon: [
      { url: "/images/vijayagiri-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/vijayagiri-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/vijayagiri-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/images/vijayagiri-apple-180.png", sizes: "180x180", type: "image/png" },
  },
  description: "Branch network portal for Vijayagiri Auto Agencies — authorised Yamaha dealer, Ernakulam.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080C14" },
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
