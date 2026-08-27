# ギャラクシー自動OFF・おやすみモード 差分

このZIPは、既存のゲスト操作画面に以下を追加した差分です。

## 追加内容
- ギャラクシーモードをONにした90分後、自動でOFFする期限を `rooms.galaxy_auto_off_at` に保存。
- `/api/cron/galaxy-auto-off` を追加し、期限切れの部屋のギャラクシーモードを自動OFF。
- 各部屋の通常UI・和風軽量UIに「おやすみモード」を追加。
- おやすみモードはエアコンを維持したまま、通常照明・ギャラクシー・NEST・和風ライトだけをOFF。
- ハイテクUI上部のシーンエリアに「和風ライトOFF」を追加し、和みモード後に下までスクロールせず消灯可能にしました。

## 反映が必要なDB変更
既存Supabaseには `supabase/migration_galaxy_auto_off.sql` を実行してください。

新規セットアップの場合は更新済みの `supabase/schema.sql` または `supabase/SETUP_ALL.sql` を使えます。

## cron設定
無料cron運用の場合は `docs/free-cron-setup.md` の通り、以下のジョブを追加してください。

```text
https://あなたのアプリ.vercel.app/api/cron/galaxy-auto-off
```

推奨間隔は1〜5分です。

## 検証
```bash
node --test tests/deviceControl.behavior.test.js
```
