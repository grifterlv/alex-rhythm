import type { Metadata } from "next";
import "./globals.css";
import "./notion-theme.css";
import {MotionProvider} from './motion-preferences';
import {LanguageProvider} from './language-provider';

export const metadata: Metadata = {
  title: "留白 · Alex 的一天",
  description: "安排时间，记录真实用时，为生活留一点空间。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased notion-theme"><LanguageProvider><MotionProvider>{children}</MotionProvider></LanguageProvider></body>
    </html>
  );
}
