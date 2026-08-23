# 和風・軽量モード 差分

このZIPは「軽量モード（Lite UI）を和紙調・簡潔・清潔なテーマ」に変更した差分です。
既存リポジトリの同じパスに上書きしてください。

## 変更ファイル（2件）
- `components/LiteControlPanel.tsx` … 見た目のみ和紙調へ。ロジック（デバイス操作/多言語/アラームJST計算/props）は変更なし。
- `app/globals.css` … 先頭に Noto Serif JP / Noto Sans JP の @import を1行追加（明朝フォント用）。既存UIへの影響なし。

## GitHub Web での反映手順
ZIPは自動展開されないため、いったん展開してから以下のいずれかで反映してください。
1. 各ファイルをGitHubの該当ファイル画面で「Edit（鉛筆）」→ 全選択して貼り付け → Commit。
2. または「Add file → Upload files」で `components/` `app/` のフォルダごとドラッグ（同名パスに上書きコミットされます）。

型チェック: プロジェクトの tsconfig 設定で tsc --noEmit 通過済み。
