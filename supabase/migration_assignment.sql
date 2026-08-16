-- =============================================================================
--  予約の客室割り当て（寄せ）: 実際に泊まる物理部屋を上書きする。
--    assigned_room_id = NULL  … 元の予約どおり（既定・従来動作）
--    assigned_room_id = 別部屋 … 看板を付け替えて別の部屋に泊まらせる運用に対応。
--  ゲスト画面/PIN/機器操作は「割り当て先の物理部屋」を基準に解決される。
--  元の room_id は残すので iCal同期・キャンセル追跡・タンク計算は従来どおり。
-- =============================================================================
alter table public.reservations
  add column if not exists assigned_room_id uuid references public.rooms(id) on delete set null;

create index if not exists idx_reservations_assigned
  on public.reservations (assigned_room_id) where assigned_room_id is not null;
