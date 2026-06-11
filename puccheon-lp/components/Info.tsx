// 営業時間・アクセス情報セクション
import { Clock, MapPin } from "lucide-react";
import FadeIn from "./FadeIn";

export default function Info() {
  return (
    <section className="bg-white px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <h2
            className="text-center font-serif font-bold"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}
          >
            営業時間・アクセス
          </h2>
        </FadeIn>

        <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-2">
          <FadeIn>
            <div className="flex h-full flex-col rounded-2xl bg-cream p-8">
              <div className="flex items-center gap-3">
                <Clock className="h-7 w-7 text-pink" aria-hidden="true" />
                <h3 className="font-serif text-xl font-bold">営業時間</h3>
              </div>
              <dl className="mt-6 space-y-4 text-sm sm:text-base">
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <dt className="font-bold">ランチ（土日祝のみ）</dt>
                  <dd className="text-ink/70">11:30〜14:30（L.O. 14:00）</dd>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <dt className="font-bold">ディナー（毎日）</dt>
                  <dd className="text-ink/70">17:30〜23:00（L.O. 22:30）</dd>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <dt className="font-bold">定休日</dt>
                  <dd className="text-ink/70">不定休</dd>
                </div>
              </dl>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="flex h-full flex-col rounded-2xl bg-cream p-8">
              <div className="flex items-center gap-3">
                <MapPin className="h-7 w-7 text-pink" aria-hidden="true" />
                <h3 className="font-serif text-xl font-bold">アクセス</h3>
              </div>
              <div className="mt-6 space-y-2 text-sm sm:text-base">
                <p>東京都世田谷区経堂1丁目（経堂駅から徒歩3分）</p>
                <p>席数: 22席（2フロア）</p>
              </div>
              <div className="mt-6 overflow-hidden rounded-xl">
                <iframe
                  title="プッチョンの地図"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3242.0!2d139.6395!3d35.6595!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzXCsDM5JzM0LjIiTiAxMznCsDM4JzIyLjIiRQ!5e0!3m2!1sja!2sjp!4v0000000000000"
                  width="100%"
                  height="240"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
