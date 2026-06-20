import { redirect } from "next/navigation";

// トップ(/)は管理画面へ。ホーム画面アイコンやドメイン直アクセス用。
export default function Home() {
  redirect("/admin");
}
