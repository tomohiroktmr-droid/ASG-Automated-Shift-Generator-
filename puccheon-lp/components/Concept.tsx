// コンセプトセクション：ダーク背景にリード文と3つの特徴カード
import { Soup, Users, Heart } from "lucide-react";
import FadeIn from "./FadeIn";

const features = [
  {
    icon: Soup,
    title: "韓国家庭料理",
    text: "辛さの奥に、ほっとする味。",
  },
  {
    icon: Users,
    title: "夫婦二人で",
    text: "席は22席。顔の見える距離で。",
  },
  {
    icon: Heart,
    title: "経堂で9年",
    text: "この街の人たちに育ててもらいました。",
  },
];

export default function Concept() {
  return (
    <section className="bg-dark px-4 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <p className="text-balance text-center font-serif font-bold leading-relaxed" style={{ fontSize: "clamp(1.4rem, 3.5vw, 2.2rem)" }}>
            韓国語で&ldquo;フライパン&rdquo;という意味の店名には、
            <br className="hidden sm:block" />
            家庭料理への敬意が込められています。
          </p>
        </FadeIn>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {features.map((feature, i) => (
            <FadeIn key={feature.title} delay={i * 0.15}>
              <div className="flex h-full flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                <feature.icon className="h-10 w-10 text-yellow" aria-hidden="true" />
                <h3 className="mt-4 font-serif text-xl font-bold">{feature.title}</h3>
                <p className="mt-3 text-sm text-white/70">{feature.text}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
