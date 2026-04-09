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

## データ連携

勤怠データの送受信は [`src/utils/gas.ts`](/Users/utsunomiyahibiki/pibicco/attendance-web-app-main/src/utils/gas.ts) から行っています。

- `sendToSheet`: 出勤、休憩、退勤データの送信
- `getTodayRecord`: 当日の勤怠取得
- `getMonthlyRecords`: 月別勤怠取得

通信先 URL はコード内で固定されています。

## 画面構成

- ホーム: 当日の勤務状況と打刻操作
- 履歴: 月別の勤務履歴一覧
- 集計: 月別の勤務集計

画面切り替えは [`src/App.tsx`](/Users/utsunomiyahibiki/pibicco/attendance-web-app-main/src/App.tsx) の下部ナビゲーションで行っています。

## デプロイ

このリポジトリは GitHub Actions で GitHub Pages に公開されます。

- `main` ブランチに push
- GitHub Actions が `dist` をビルド
- GitHub Pages に自動デプロイ

ワークフロー定義:
[`/.github/workflows/deploy.yml`](/Users/utsunomiyahibiki/pibicco/attendance-web-app-main/.github/workflows/deploy.yml)

## 補足

- `dist/` は生成物なのでコミット不要です
- `.DS_Store` は `.gitignore` で除外しています
- `package.json` にある `npm run deploy` は残っていますが、現在の公開フローは GitHub Actions ベースです
