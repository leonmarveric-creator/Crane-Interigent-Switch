-- =============================================================================
--  建物（棟）の区別列 building を追加
--  Crane Nest   … 既存4部屋（春夏秋冬）
--  Crane Nest 2 … 新規5部屋（松竹梅林荷）
--  管理画面はこの値で部屋をグループ分け・バッジ表示する。
-- =============================================================================
alter table public.rooms
  add column if not exists building text not null default 'Crane Nest';

-- 既存4部屋を明示的に Crane Nest に（既定値と同じだが念のため）
update public.rooms set building = 'Crane Nest'
  where slug in ('room-spring', 'room-summer', 'room-autumn', 'room-winter');

create index if not exists idx_rooms_building on public.rooms (building);
