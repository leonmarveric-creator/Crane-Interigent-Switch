-- スマートキー: 解錠後の施錠方法をドアごとに選べるようにする

-- 解錠後の施錠方法 (ドアごと): timer=◯秒後 / sensor=ドアを閉めると(オープンセンサー) / off=自動施錠しない
alter table public.smartkey_settings
  add column if not exists entrance_lock text not null default 'timer',
  add column if not exists room_lock     text not null default 'timer';
do $$ begin
  alter table public.smartkey_settings
    add constraint chk_smartkey_lock_modes
    check (entrance_lock in ('timer','sensor','off') and room_lock in ('timer','sensor','off'));
exception when duplicate_object then null; end $$;
