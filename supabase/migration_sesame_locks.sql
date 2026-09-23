-- =============================================================================
--  Sesame 一覧（鍵の台帳）
--   ・Sesame を1台ずつ登録し、部屋 / エントランスにプルダウンで割り当てる
--   ・割り当て時に UUID / シークレットキー / APIキーを rooms / entrances へコピーするので、
--     既存の解錠処理はそのまま動く
--   ・このSQLは、今 rooms / entrances に入っている Sesame を自動で一覧に取り込む
--  すべて idempotent (何度実行してもOK)。RLS有効・ポリシー無し → サーバ専用。
--  ※ 先に migration_smartkey.sql を実行しておくこと
-- =============================================================================

create table if not exists public.sesame_locks (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                 -- 例: "HARU ドア" / "Crane Nest エントランス"
  device_uuid  text not null unique,          -- 大文字・ハイフン付きで保存
  secret_key   text not null,                 -- 32桁hex (サーバ専用)
  api_key      text,                          -- 空なら環境変数 SESAME_API_KEY
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

do $$ begin
  create trigger trg_sesame_locks_touch before update on public.sesame_locks
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null; end $$;

alter table public.sesame_locks enable row level security;

alter table public.rooms
  add column if not exists sesame_lock_id uuid references public.sesame_locks(id) on delete set null;
alter table public.entrances
  add column if not exists sesame_lock_id uuid references public.sesame_locks(id) on delete set null;

-- ---- 既存の部屋の Sesame を取り込み ----
insert into public.sesame_locks (name, device_uuid, secret_key, api_key)
select distinct on (upper(r.sesame_device_uuid))
       r.display_name || ' ドア', upper(r.sesame_device_uuid), lower(r.sesame_secret_key), r.sesame_api_key
from public.rooms r
where r.sesame_device_uuid is not null and r.sesame_device_uuid <> ''
  and r.sesame_secret_key  is not null and r.sesame_secret_key  <> ''
order by upper(r.sesame_device_uuid), r.slug
on conflict (device_uuid) do nothing;

update public.rooms r
   set sesame_lock_id = l.id
  from public.sesame_locks l
 where r.sesame_lock_id is null
   and r.sesame_device_uuid is not null
   and upper(r.sesame_device_uuid) = l.device_uuid;

-- ---- 既存のエントランスの Sesame を取り込み ----
insert into public.sesame_locks (name, device_uuid, secret_key, api_key)
select distinct on (upper(e.sesame_device_uuid))
       e.display_name, upper(e.sesame_device_uuid), lower(e.sesame_secret_key), e.sesame_api_key
from public.entrances e
where e.sesame_device_uuid is not null and e.sesame_device_uuid <> ''
  and e.sesame_secret_key  is not null and e.sesame_secret_key  <> ''
order by upper(e.sesame_device_uuid), e.slug
on conflict (device_uuid) do nothing;

update public.entrances e
   set sesame_lock_id = l.id
  from public.sesame_locks l
 where e.sesame_lock_id is null
   and e.sesame_device_uuid is not null
   and upper(e.sesame_device_uuid) = l.device_uuid;
