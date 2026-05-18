# attendance-web-app

React + TypeScript + Vite で作られた勤怠管理アプリです。

公開先:
[https://pibicco.github.io/attendance-web-app/](https://pibicco.github.io/attendance-web-app/)

## できること

- ホーム画面で当日の出勤、休憩、退勤を記録
- 履歴画面で月ごとの勤怠一覧を確認
- 集計画面で勤務日数や労働時間を確認

## 技術構成

- React 19
- TypeScript
- Vite
- Zustand
- date-fns
- GitHub Pages

## セットアップ

```bash
npm install
```

## 開発コマンド

開発サーバー:

```bash
npm run dev
```

Lint:

```bash
npm run lint
```

本番ビルド:

```bash
npm run build
```

ローカルで本番ビルド確認:

```bash
npm run preview
```

## データ連携（Google スプレッドシート）

対象スプレッドシート: [勤怠管理アプリ](https://docs.google.com/spreadsheets/d/1QajsUci9L_a4HABS5c4qZ6Mu0-9zoBV9I8zxqGYllhk/edit)

| 列 | 項目 |
| --- | --- |
| A | 日付 |
| B | 出勤 |
| C | 退勤 |
| D | 休憩分 |
| E | 勤務時間 |
| F | 休憩中 |
| G | 休憩開始 |

月ごとにシート名 `yyyy-MM`（例: `2026-05`）のタブに記録します。

### 初回セットアップ

1. スプレッドシートで **拡張機能 → Apps Script** を開く
2. [`google-apps-script/Code.gs`](google-apps-script/Code.gs) の内容を貼り付けて保存
3. **デプロイ → 新しいデプロイ → ウェブアプリ**
   - 実行ユーザー: 自分
   - アクセス: 全員
4. 発行された URL を `.env` に設定:

```bash
cp .env.example .env
# VITE_GAS_URL=（デプロイ URL）を編集
```

5. `npm run dev` で起動

勤怠データの送受信は [`src/utils/gas.ts`](src/utils/gas.ts) から行います。

- `sendToSheet`: 出勤、休憩、退勤データの送信
- `getTodayRecord`: 当日の勤怠取得
- `getMonthlyRecords`: 月別勤怠取得

## 画面構成

- ホーム: 当日の勤務状況と打刻操作
- 履歴: 月別の勤務履歴一覧
- 集計: 月別の勤務集計

画面切り替えは [`src/App.tsx`](src/App.tsx) の下部ナビゲーションで行っています。

## デプロイ

このリポジトリは GitHub Actions で GitHub Pages に公開されます。

- `main` ブランチに push
- GitHub Actions が `dist` をビルド
- GitHub Pages に自動デプロイ

ワークフロー定義:
[`/.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

## 補足

- `dist/` は生成物なのでコミット不要です
- `.DS_Store` は `.gitignore` で除外しています
