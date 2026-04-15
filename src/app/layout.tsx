import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "教师百宝箱 — AI教学知识库",
  description: "以教师自己的教学资料为知识底座的AI教学平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
