# プッチョン LP

韓国家庭料理居酒屋「プッチョン」（東京都世田谷区経堂）のランディングページです。

## 技術スタック

- Next.js 14（App Router）/ TypeScript
- Tailwind CSS
- Framer Motion（スクロール時のフェードイン）
- lucide-react（アイコン）
- next/font（Noto Serif JP / Noto Sans JP）

## 起動方法

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) で確認できます。

本番ビルド:

```bash
npm run build
npm run start
```

## 差し替えが必要な箇所

### 画像

すべて `https://placehold.co/...` のプレースホルダー画像を使用しています。実際の写真に差し替える場合は以下を編集してください。

- `components/Menu.tsx` … 各メニューカテゴリーの `image` / `alt`（`おつまみ` `鍋・スープ` `ご飯もの` `麺類`）
- 画像ファイルを使う場合は `public/images/` 配下に配置し、`/images/xxx.jpg` のようなパスを指定してください

### 予約URL（ebica スマート予約）

`lib/constants.ts` の `RESERVATION_URL` を変更すると、ヘッダー・Hero・予約セクションの全ボタンに反映されます。

```ts
export const RESERVATION_URL = "https://booking.ebica.jp/webrsv/search/e014088001/26654?isfixshop=true";
```

### 営業時間・アクセス・地図

`components/Info.tsx` 内の営業時間テキスト、住所、Google マップの埋め込み `iframe` の `src` を実際の店舗情報に差し替えてください。

### メニュー内容・価格

`components/Menu.tsx` の `categories` 配列を編集してください。

### コピーライト

`components/Footer.tsx` の会社名・年表記を編集してください。

## Vercel へのデプロイ手順

1. [Vercel](https://vercel.com) にログインし、「Add New... > Project」を選択
2. このリポジトリ（`puccheon-lp` ディレクトリ）をインポート
   - リポジトリ全体を取り込む場合は、プロジェクト設定の **Root Directory** を `puccheon-lp` に指定
3. Framework Preset は `Next.js` のまま（自動検出されます）
4. ビルドコマンド・出力ディレクトリはデフォルトのままでOK（`next build` / `.next`）
5. 「Deploy」をクリックしてデプロイ
6. 以後、対象ブランチへの push で自動的に再デプロイされます
