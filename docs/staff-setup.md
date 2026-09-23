# スタッフ画面 (/staff) セットアップ

1. Supabase の SQL Editor で `supabase/migration_staff.sql` を実行
2. Vercel の環境変数に `STAFF_PASSWORD`（お母さん用のパスワード。数字だけでもOK）を追加 → 再デプロイ
3. お母さんのスマホで `https://<サイト>/staff` を開いてログイン → 共有メニュー →「ホーム画面に追加」

- 管理者としてログイン済みなら、そのまま /staff も開けます
- パスワードを変えると、全員ログアウトされます
- 早期チェックイン / レイトチェックアウトは Airbnb 同期で消えません（別の列に保存）

## Face ID / 指紋ログイン（パスキー）

1. Supabase で `supabase/migration_staff_passkeys.sql` を実行
2. お母さんのスマホで /staff にパスワードでログイン →「今天」の「用 Face ID 登录 → 现在设置」を押して顔を見せる
   （「记录」タブの一番下からも設定・削除できます）
3. 次からログイン画面の緑のボタン「用 Face ID 登录」でログイン（パスワードも予備として使えます）
- 顔・指紋のデータはスマホから出ません。サーバには公開鍵だけを保存します。
- スマホをなくしたら「记录」タブ下で削除（または staff_passkeys の行を削除）。
- STAFF_PASSWORD は引き続き必要です（Face ID ログインでも同じ Cookie を発行するため）。
