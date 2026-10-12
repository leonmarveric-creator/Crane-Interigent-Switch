-- 招待くじの音 (BGM・効果音) の設定。ファイルは既存の非公開バケット keepsake の sounds/ に置く
alter table public.keepsake_settings add column if not exists sounds jsonb not null default '{}'::jsonb;
insert into public.keepsake_settings (id) values (1) on conflict (id) do nothing;
notify pgrst, 'reload schema';
