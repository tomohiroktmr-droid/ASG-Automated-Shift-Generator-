// 予約導線セクション：ピンク背景でebicaスマート予約へ誘導
import { RESERVATION_URL } from "@/lib/constants";
import FadeIn from "./FadeIn";

export default function ReservationCTA() {
  return (
    <section className="bg-pink px-4 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <FadeIn>
          <h2
            className="font-serif font-bold"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}
          >
            お席のご予約はこちらから
          </h2>
          <a
            href={RESERVATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex min-h-[44px] items-center justify-center rounded-full bg-white px-10 py-4 font-bold text-pink transition-transform hover:scale-105"
          >
            予約ページへ
          </a>
          <p className="mt-6 text-sm text-white/90">
            ebica（スマート予約）からご予約いただけます。お電話でのご予約も承っております。
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
