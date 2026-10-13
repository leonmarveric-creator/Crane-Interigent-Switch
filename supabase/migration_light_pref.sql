-- コンシェルジュで選ぶ「お部屋に着いたときの明かり」(wafu = 和の灯り / normal = ふつうの明かり)
alter table public.reservations add column if not exists light_pref text;
