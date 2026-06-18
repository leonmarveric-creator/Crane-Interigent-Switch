# 民泊 IoT ゲストコントロール / ホスト管理ダッシュボード

ゲストが滞在期間中のみ専用URLから、自室のスマートロック（Sesame 5）とエアコン・照明（SwitchBot ハブミニ）を操作できる Web アプリ。予約は Airbnb iCal の自動同期と手動追加のハイブリッド。

近未来・サイバー調のダークUI（グラスモーフィズム＋ネオン）、アイコン中心の多言語（日本語 / English / 中文 / 한국어）モバイルファースト設計。

---

## 1. アーキテクチャ概要

```
ゲスト端末 (PWA的なモバイルWeb)
   │  /room/[slug]?token=xxxx&lang=en
   ▼
Next.js (App Router) ── Server Componentで滞在を検証
   │   ├─ 期間内 → ControlPanel (Client, Framer Motion)
   │   └─ 期間外/無効 → AccessDenied
   │
   ├─ POST /api/devices/[slug]  … デバイス操作プロキシ（秘密鍵はここから出ない）
   │       ├─ Sesame  : AES-CMAC署名 → candyhouse Web API
   │       └─ SwitchBot: HMAC-SHA256署名 → OpenAPI v1.1
   ├─ POST /api/alarms/[slug]   … 光目覚ましの設定/解除
   │
   └─ Vercel Cron
         ├─ /api/cron/sync-ical   (毎時) iCal差分同期
         └─ /api/cron/wake-alarm  (2分毎) 光目覚まし点灯

Supabase (PostgreSQL)  rooms / reservations / alarms  ※RLSで全拒否→service_role経由のみ
```

セキュリティの肝は **「秘密情報をクライアントに一切渡さない」**。`SUPABASE_SERVICE_ROLE_KEY`、Sesame の `secret_key`/`api_key`、SwitchBot の `token`/`secret` はすべてサーバ（API Routes）内でのみ使用し、ブラウザには `room slug` と `guest_token` だけが存在します。Supabase の RLS はポリシーを作らず全拒否にして、`service_role` を持つサーバ経由でしか読み書きできない構成です。

## 2. ファイル構成

| パス | 役割 |
|---|---|
| `supabase/schema.sql` | DDL（rooms / reservations / alarms）＋ RLS ＋ トリガ |
| `lib/supabaseAdmin.ts` | service_role クライアント（サーバ専用） |
| `lib/auth.ts` | slug＋token＋現在時刻で滞在を検証 |
| `lib/sesame.ts` | Sesame 5 の AES-CMAC 署名とコマンド送信 |
| `lib/switchbot.ts` | SwitchBot OpenAPI v1.1（HMAC署名）AC/照明 |
| `lib/ical.ts` | Airbnb iCal 取得＋チェックイン/アウト時刻補正 |
| `app/api/devices/[room_id]/route.ts` | デバイス操作プロキシ |
| `app/api/alarms/[room_id]/route.ts` | 光目覚まし設定 |
| `app/api/cron/sync-ical/route.ts` | iCal 差分同期 |
| `app/api/cron/wake-alarm/route.ts` | 光目覚まし点灯 |
| `app/room/[room_id]/page.tsx` | ゲスト画面（サーバで検証） |
| `components/ControlPanel.tsx` | 操作UI（ロック/AC/照明/目覚まし/言語） |
| `components/AccessDenied.tsx` | サイバー風アクセス拒否画面 |
| `lib/i18n.ts` | ja/en/zh/ko 辞書 |

## 3. セットアップ

```bash
npm install
cp .env.example .env.local   # 値を設定
# Supabase SQL Editor で supabase/schema.sql を実行
npm run dev
```

各部屋を `rooms` に登録（slug, デバイスID, Sesame鍵, iCal URL）。Vercel へデプロイし、`vercel.json` の Cron が自動で有効化されます。`CRON_SECRET` を Vercel の環境変数とCron設定の Bearer に一致させてください。

---

## 4. システム拡張と運用のためのアドバイス

### 4部屋→9部屋へのスケール
動的設計済みです。拡張時のコードは原則ゼロ。`rooms` に行を追加するだけで `/room/[slug]` が増えます。Cron は `is_active=true` の全部屋をループするので自動的に対象に入ります。運用を楽にするため、後述のホスト管理画面から部屋登録できるようにしておくと現場で完結します。

### ホスト用管理ダッシュボード（次の実装ステップ）
本リポジトリはゲスト操作＋同期基盤までを実装しています。ホスト画面は `app/admin` 配下に、Supabase Auth（メール＋ロール）でログインを保護して追加するのが推奨です。必要機能は、部屋一覧とデバイス疎通テスト、予約のカレンダー表示（iCal/手動の混在）、手動予約の追加（room＋期間入力→`source='manual'`でinsert→`guest_token`自動発行→URLとQRを即発行）、予約ごとのURL再発行（トークンローテーション）、稼働ログの閲覧。手動予約は `airbnb_uid=NULL` なので iCal 同期のキャンセル処理に巻き込まれません（同期側は `source='ical'` のみを無効化対象にしています）。

### iCal 同期の堅牢化
- フェッチ失敗時はその部屋をスキップし、絶対にキャンセル判定をしない実装にしています（誤って有効な予約を無効化しないため）。Airbnb 側の一時的な障害で全予約が消える事故を防げます。
- Airbnb の iCal は終日（DATE）値なので、`applyStayTimes` でチェックイン15:00 / チェックアウト10:00（JST）を付与しています。物件の実際の時刻に合わせて調整してください。
- 将来 Booking.com や楽天トラベル等を足す場合は、`rooms` に複数 iCal URL を持たせ（`jsonb` 配列化）、`airbnb_uid` を `external_uid`＋`source_platform` に一般化すると無理なく拡張できます。

### トークン運用とセキュリティ
- `guest_token` は 24byte 乱数（48hex）。URLが第三者に渡っても、滞在期間外は `AccessDenied` になるため被害は限定的です。
- チェックアウト後は `status` を見て弾かれますが、念のため過去予約を定期的に `completed` 化するバッチ、退去直後の自動施錠（Cronで `check_out` 到来時に lock）を入れると安全です。
- レート制限（同一トークンの連打抑制）を `/api/devices` に入れると、IR連打によるデバイス不調を防げます。Upstash Redis などが手軽です。
- 監査ログ用に `device_logs` テーブル（誰が・いつ・どの操作・成否）を追加し、トラブル時の問い合わせ対応に備えると運用が安定します。

### デバイス連携の注意点
- SwitchBot は赤外線（IR）なので「状態」を持ちません。アプリ上のON/OFF表示はあくまで楽観的UIです。実機の現状と必ず一致する保証はない旨を、アイコンの色で曖昧に伝える設計にしています（文章は最小化）。
- Sesame は施錠状態を取得できるので、`/api/devices` に GET（状態取得）を足して初期表示を実機同期させると体験が向上します。
- SwitchBot OpenAPI には日次リクエスト上限があります。状態ポーリングを多用する場合はキャッシュ層を挟んでください。

### 多言語・UX
- 辞書は `lib/i18n.ts` に集約。言語追加は `LANGS` と `T` に1ブロック足すだけです。
- 初期言語は `?lang=` →予約の `guest_lang` →`en` の順で決定。ゲストはヘッダの地球儀アイコンからいつでも切替可能。
- 操作フィードバックは Framer Motion（波紋・解錠グロー）＋ `navigator.vibrate` で触覚も付与し、言語に依存しない直感性を担保しています。

### 監視・信頼性
Cron 結果（追加/更新/キャンセル件数、点灯件数）はレスポンスJSONで返るので、Vercel のログまたは外部監視（Better Stack 等）で失敗を検知できるようにしておくと安心です。デバイス操作失敗時は 502 を返すため、フロントでリトライ導線（再タップ）を促す設計にしています。
```
