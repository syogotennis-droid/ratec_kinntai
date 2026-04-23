# 勤怠・給与計算システム (ratec_kinntai)

カレンダー入力連動型 勤怠・給与計算システム

## 概要

現在の「カレンダーに勤務時間を入力する運用」を大きく変えずに、  
勤務時間集計・残業計算・給与計算・一覧確認を自動化するWebシステムです。

## 機能

- **カレンダー入力**：スマホでカレンダー形式で勤務時間を入力
- **自動集計**：日次・月次の勤務時間を自動計算
- **給与計算**：時給・残業割増・深夜割増・休日割増を自動算出
- **管理者機能**：全従業員の勤務状況確認・修正・月次締め
- **CSV出力**：勤務一覧・給与一覧のエクスポート

## 技術スタック

| 区分 | 技術 |
|------|------|
| バックエンド | Python 3.11 / FastAPI / SQLAlchemy / SQLite |
| フロントエンド | React 18 / TypeScript / Vite / Tailwind CSS |
| カレンdar | FullCalendar |
| 認証 | JWT (Bearer Token) |
| インフラ | Docker Compose |

## セットアップ

### 方法1: Docker Compose（推奨）

```bash
docker-compose up --build
```

- フロントエンド: http://localhost:5173
- バックエンドAPI: http://localhost:8000
- APIドキュメント: http://localhost:8000/docs

### 方法2: ローカル起動

**バックエンド**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**フロントエンド**
```bash
cd frontend
npm install
npm run dev
```

## 初期ログイン

| 項目 | 値 |
|------|-----|
| 社員番号 | admin |
| パスワード | admin1234 |
| 権限 | 管理者 |

## ディレクトリ構成

```
ratec_kinntai/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI エントリーポイント
│   │   ├── models.py        # SQLAlchemy モデル
│   │   ├── schemas.py       # Pydantic スキーマ
│   │   ├── auth.py          # JWT 認証
│   │   ├── database.py      # DB 設定
│   │   ├── routers/         # API ルーター
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── work_records.py
│   │   │   ├── payroll.py
│   │   │   ├── closing.py
│   │   │   └── export.py
│   │   └── services/        # ビジネスロジック
│   │       ├── calculation.py  # 勤務時間計算
│   │       └── payroll.py      # 給与計算
│   ├── requirements.txt
│   └── seed.py              # サンプルデータ投入
├── frontend/
│   ├── src/
│   │   ├── pages/           # 各画面
│   │   ├── components/      # 共通コンポーネント
│   │   ├── services/        # API クライアント
│   │   ├── contexts/        # React Context
│   │   └── types/           # TypeScript 型定義
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 計算ルール

- **実働時間** = 終了時刻 − 開始時刻 − 休憩時間
- **残業時間** = 実働時間 − 所定労働時間（デフォルト8時間/日）
- **深夜時間** = 22:00〜翌5:00 の重複時間
- **休日時間** = 勤務区分「休日出勤」の実働時間
- **日跨ぎ勤務**対応（例: 22:00〜翌5:00）

## 今後の拡張予定

- QRコード打刻
- GPS打刻
- シフト申請・承認
- 有給管理
- 給与明細PDF発行
- LINE通知
- 会計ソフト連携
