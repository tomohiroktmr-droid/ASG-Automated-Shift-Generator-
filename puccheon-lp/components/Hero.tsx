"use client";

// ファーストビュー：キャッチコピーとCTAボタン、装飾図形
import { motion } from "framer-motion";
import { RESERVATION_URL } from "@/lib/constants";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-4 pt-20"
    >
      {/* 装飾図形 */}
      <svg
        className="pointer-events-none absolute -left-10 top-24 h-40 w-40 text-pink/30 sm:h-56 sm:w-56"
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="100" cy="100" r="100" fill="currentColor" />
      </svg>
      <svg
        className="pointer-events-none absolute right-0 top-1/3 h-32 w-32 text-yellow/40 sm:h-48 sm:w-48"
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="100" cy="100" r="100" fill="currentColor" />
      </svg>
      <svg
        className="pointer-events-none absolute bottom-10 left-1/4 h-28 w-28 text-green/30 sm:h-40 sm:w-40"
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden="true"
      >
        <polygon points="100,10 190,180 10,180" fill="currentColor" />
      </svg>
      <svg
        className="pointer-events-none absolute right-10 bottom-24 h-20 w-20 text-pink/20 sm:h-32 sm:w-32"
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden="true"
      >
        <polygon points="100,10 190,180 10,180" fill="currentColor" />
      </svg>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="font-serif font-bold leading-tight"
          style={{ fontSize: "clamp(2.5rem, 8vw, 5rem)" }}
        >
          世田谷・経堂で、
          <br />
          韓国の家庭料理を。
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="mx-auto mt-6 max-w-xl text-base text-ink/70 sm:text-lg"
        >
          プッチョン — 韓国語で&ldquo;フライパン&rdquo;。
          <br />
          母の味を、あなたの食卓に。
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a
            href={RESERVATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-pink px-8 py-3 font-bold text-white transition-transform hover:scale-105 sm:w-auto"
          >
            席を予約する
          </a>
          <a
            href="#menu"
            className="flex min-h-[44px] w-full items-center justify-center rounded-full border-2 border-ink px-8 py-3 font-bold text-ink transition-colors hover:bg-ink hover:text-cream sm:w-auto"
          >
            メニューを見る
          </a>
        </motion.div>
      </div>
    </section>
  );
}
