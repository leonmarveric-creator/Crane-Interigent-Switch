# 無料cron設定ガイド（Vercel Hobby向け）

Vercel Hobbyプランはcronが**1日1回まで**で、毎時・数分毎の実行はデプロイが失敗する。
そこで **cron-job.org（無料・1分間隔OK）** から2つのAPIを叩いて、光目覚ましと予約同期を無料で動かす。

## 前提：CRON_SECRET を確認
Vercel のプロジェクト設定 → Environment Variables に `CRON_SECRET` があること。
その値を控えておく（cron-job.org 側で使う）。無ければ長いランダム文字列を設定して再デプロイ。

本番URLを `https://あなたのアプリ.vercel.app` とする。

## 叩くURL（2つ）

| 用途 | URL | 推奨間隔 |
|---|---|---|
| 光目覚まし点灯 | `https://あなたのアプリ.vercel.app/api/cron/wake-alarm` | 1〜2分 |
| Airbnb予約同期 | `https://あなたのアプリ.vercel.app/api/cron/sync-ical` | 15〜30分 |

※ 4部屋あっても **wake-alarm は1本でOK**。エンドポイントが「時刻の来た全アラーム」を
まとめて処理するので、部屋ごとにcronを分ける必要はない。

## 認証（どちらか）
- **推奨：ヘッダー方式**　`Authorization: Bearer <CRON_SECRET>` をリクエストヘッダに追加
- 簡易：URL方式　`...?key=<CRON_SECRET>` をURL末尾に付ける（URLに秘密が載るので非推奨）

## cron-job.org の設定手順
1. https://cron-job.org に無料登録してログイン。
2. 「CREATE CRONJOB」をクリック。
3. **Title**: `wake-alarm`
4. **URL**: `https://あなたのアプリ.vercel.app/api/cron/wake-alarm`
5. **Schedule**: 「Every 1 minute」（または2分毎）を選択。
6. 「Advanced」→ **Headers** に `Key: Authorization` / `Value: Bearer <CRON_SECRET>` を追加。
7. 保存。
8. 同じ手順でもう1つ作る：
   - Title `sync-ical` / URL `.../api/cron/sync-ical` / Schedule「Every 30 minutes」/ 同じ認証ヘッダ。

## 動作確認
- cron-job.org の各ジョブの「History」でステータス 200 が返っていればOK。
- 401 が返る場合は CRON_SECRET の不一致（ヘッダの値を確認）。
- 光目覚ましは、テストページか予約中の部屋で時刻を「今から2〜3分後」に設定し、
  実際にライトが点くか確認する。

## 補足
- `vercel.json` には無料枠内の「1日1回 sync-ical（0:00 JST）」だけ残してある（予約同期の保険）。
  cron-job.org 側が主で、これは万一外部cronが止まったときのバックアップ。
- 無料のままで運用可能。将来 Vercel Pro にすれば `vercel.json` だけで数分毎cronが使える。
