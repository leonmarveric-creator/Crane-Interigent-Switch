-- 便槽: 汲み取りの履歴 (汲み取り完了を押したときに、そのときの量・泊数・人数を残す)
create table if not exists stays_tank_history (
  id bigserial primary key,
  emptied_on date not null,
  prev_emptied_on date,
  liters numeric not null default 0,
  nights int not null default 0,
  guest_nights int not null default 0,
  created_at timestamptz not null default now()
);
alter table stays_tank_history enable row level security;
