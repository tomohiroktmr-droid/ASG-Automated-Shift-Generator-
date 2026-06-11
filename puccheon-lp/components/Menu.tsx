// メニューセクション：カテゴリー別に料理名と価格を一覧表示
import Image from "next/image";
import FadeIn from "./FadeIn";

type MenuItem = {
  name: string;
  price: string;
};

type MenuCategory = {
  title: string;
  image: string;
  alt: string;
  items: MenuItem[];
};

const categories: MenuCategory[] = [
  {
    title: "おつまみ",
    image: "https://placehold.co/600x400",
    alt: "韓国風おつまみ盛り合わせの写真",
    items: [
      { name: "チヂミ（海鮮 / ニラ）", price: "¥980" },
      { name: "ナムル盛り合わせ", price: "¥780" },
      { name: "チャンジャ豆腐", price: "¥680" },
      { name: "韓国風唐揚げ（ヤンニョムチキン）", price: "¥980" },
      { name: "キムチ盛り合わせ", price: "¥580" },
    ],
  },
  {
    title: "鍋・スープ",
    image: "https://placehold.co/600x400",
    alt: "スンドゥブチゲの写真",
    items: [
      { name: "スンドゥブチゲ", price: "¥980" },
      { name: "テールスープ", price: "¥1,280" },
      { name: "サムゲタン（要予約）", price: "¥2,480" },
      { name: "プデチゲ（2人前〜）", price: "¥2,480" },
      { name: "わかめスープ", price: "¥580" },
    ],
  },
  {
    title: "ご飯もの",
    image: "https://placehold.co/600x400",
    alt: "石焼ビビンバの写真",
    items: [
      { name: "石焼ビビンバ", price: "¥1,180" },
      { name: "クッパ", price: "¥980" },
      { name: "韓国海苔巻き（キンパ）", price: "¥780" },
      { name: "チーズタッカルビ丼", price: "¥1,280" },
      { name: "白ごはん", price: "¥220" },
    ],
  },
  {
    title: "麺類",
    image: "https://placehold.co/600x400",
    alt: "冷麺の写真",
    items: [
      { name: "韓国冷麺", price: "¥980" },
      { name: "チャプチェ", price: "¥880" },
      { name: "辛ラーメン（チーズトッピング可）", price: "¥780" },
      { name: "カルグクス（韓国うどん）", price: "¥980" },
    ],
  },
];

export default function Menu() {
  return (
    <section id="menu" className="bg-cream px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <h2
            className="text-center font-serif font-bold"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)" }}
          >
            定番メニュー
          </h2>
        </FadeIn>

        <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-2">
          {categories.map((category, i) => (
            <FadeIn key={category.title} delay={i * 0.1}>
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="relative aspect-[3/2] w-full">
                  <Image
                    src={category.image}
                    alt={category.alt}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-serif text-xl font-bold">{category.title}</h3>
                  <ul className="mt-4 divide-y divide-ink/10">
                    {category.items.map((item) => (
                      <li
                        key={item.name}
                        className="flex items-center justify-between gap-4 py-3 text-sm sm:text-base"
                      >
                        <span>{item.name}</span>
                        <span className="whitespace-nowrap font-bold text-pink">
                          {item.price}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.2}>
          <p className="mt-10 text-center text-xs text-ink/50 sm:text-sm">
            ※メニューは季節により変更になる場合があります
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
