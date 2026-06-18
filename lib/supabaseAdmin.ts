import { createClient } from "@supabase/supabase-js";

/**
 * service_role クライアント。RLSをバイパスするため **サーバ専用**。
 * 絶対に Client Component / ブラウザへ import しないこと。
 */
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
