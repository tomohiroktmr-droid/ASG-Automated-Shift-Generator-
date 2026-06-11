import type { Metadata } from "next";
import { Noto_Serif_JP, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-noto-serif-jp",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "プッチョン | 経堂の韓国家庭料理居酒屋",
  description:
    "世田谷・経堂で、韓国の家庭料理を。プッチョン — 韓国語で「フライパン」。母の味を、あなたの食卓に。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${notoSerifJP.variable} ${notoSansJP.variable} font-sans antialiased bg-cream text-ink`}
      >
        {children}
      </body>
    </html>
  );
}
