# Pedalboard Demo

ギターエフェクターをシミュレートする Web アプリケーション。

## 概要

ブラウザ上でギターエフェクターを並べ替え、音声ファイルにエフェクトを適用できるデモアプリです。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                      client/                            │
│  React + TypeScript + Vite                              │
│  - エフェクターボードの UI                               │
│  - ドラッグ&ドロップでエフェクトの並び替え                │
│  - 波形表示 (wavesurfer.js)                             │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP API
┌─────────────────────▼───────────────────────────────────┐
│                      backend/                           │
│  FastAPI + Python                                       │
│  - REST API エンドポイント                              │
│  - 音声処理 (Spotify Pedalboard ライブラリ)             │
│  - Lambda 関数としてもデプロイ可能                       │
└─────────────────────────────────────────────────────────┘
```

## ディレクトリ構成

```
pedalboard-demo/
├── client/                 # フロントエンド
│   ├── src/
│   │   ├── app/            # App コンポーネント
│   │   ├── components/     # React コンポーネント
│   │   ├── hooks/          # カスタムフック
│   │   ├── types/          # TypeScript 型定義
│   │   └── utils/          # ユーティリティ
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   └── biome.jsonc         # Linter/Formatter 設定
│
├── backend/                # バックエンド
│   ├── api/                # FastAPI 関連
│   │   ├── config.py       # 設定
│   │   ├── routes.py       # API ルート
│   │   └── schemas.py      # Pydantic モデル
│   ├── lib/                # 共通ライブラリ
│   │   ├── audio.py        # 音声処理ユーティリティ
│   │   └── effects.py      # エフェクトマッピング
│   ├── tests/              # pytest テスト
│   ├── main.py             # FastAPI エントリポイント
│   ├── lambda_function.py  # Lambda ハンドラ
│   ├── requirements.txt
│   ├── pyproject.toml      # ruff/pyright 設定
│   ├── Makefile
│   └── Dockerfile
│
├── compose.yaml            # Docker Compose 設定
├── renovate.json           # 依存関係の自動更新
└── .gitignore
```

## 技術スタック

### フロントエンド (client/)
- **React 19** - UI フレームワーク
- **TypeScript** - 型安全
- **Vite** - ビルドツール
- **Vitest** - テストフレームワーク
- **Biome** - Linter/Formatter
- **wavesurfer.js** - 波形表示
- **dnd-kit** - ドラッグ&ドロップ

### バックエンド (backend/)
- **FastAPI** - Web フレームワーク
- **Pedalboard** - Spotify の音声処理ライブラリ
- **pytest** - テストフレームワーク
- **ruff** - Linter/Formatter
- **pyright** - 型チェッカー

## エフェクト一覧

| カテゴリ | エフェクト |
|----------|------------|
| 歪み系 | Booster, Blues Driver, OverDrive, Distortion, Fuzz, Metal Zone, Heavy Metal |
| モジュレーション系 | Chorus, Dimension, Vibrato |
| 空間系 | Delay, Reverb |

## 開発コマンド

### フロントエンド

```bash
cd client
bun install        # 依存関係のインストール
bun run dev        # 開発サーバー起動
bun run test       # テスト実行 (typecheck + lint + vitest)
bun run format     # コードフォーマット
```

### バックエンド

```bash
cd backend
make install       # 依存関係のインストール
make dev           # 開発サーバー起動
make test          # テスト実行 (typecheck + lint + pytest)
make format        # コードフォーマット
```

### Docker

```bash
docker compose up  # 全サービス起動
```

## 開発の流れ

1. `client/` でエフェクトを選択・並び替え
2. "Process Audio" ボタンで API にリクエスト
3. `backend/` が Pedalboard でエフェクト処理
4. 処理結果の波形を表示・再生
