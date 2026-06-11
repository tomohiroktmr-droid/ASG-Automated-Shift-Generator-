"use client";

// 固定ヘッダー：スクロールすると半透明の背景になる
import { useEffect, useState } from "react";
import { RESERVATION_URL } from "@/lib/constants";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-cream/80 backdrop-blur-md shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <a href="#top" className="font-serif text-xl font-bold tracking-wider sm:text-2xl">
          プッチョン
        </a>
        <a
          href={RESERVATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] items-center rounded-full bg-pink px-5 py-2 text-sm font-bold text-white transition-transform hover:scale-105 sm:text-base"
        >
          予約する
        </a>
      </div>
    </header>
  );
}
