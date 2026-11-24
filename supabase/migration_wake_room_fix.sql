-- 光目覚まし: 部屋の割り当て (看板の付け替え) がある予約で、まだ鳴っていないアラームを「実際に泊まっている部屋」に直す
update public.alarms a
set room_id = r.assigned_room_id
from public.reservations r
where a.reservation_id = r.id
  and r.assigned_room_id is not null
  and a.room_id <> r.assigned_room_id
  and a.triggered_at is null;

-- 確認用 (実行すると最近 3 日の光目覚ましと、どの部屋の照明を狙ったか・点灯の記録が出る)
-- select a.fire_at at time zone 'Asia/Tokyo' as 点灯予定, a.triggered_at at time zone 'Asia/Tokyo' as 実行,
--        a.wake_mode, ro.slug as アラームの部屋, ro2.slug as 予約の元の部屋, ro3.slug as 割り当て先,
--        (select string_agg(l.action || ':' || l.success, ', ') from public.device_logs l
--          where l.room_id = a.room_id and l.source = 'cron' and l.created_at between a.fire_at - interval '15 minutes' and a.fire_at + interval '30 minutes') as 記録
-- from public.alarms a
-- join public.reservations r on r.id = a.reservation_id
-- left join public.rooms ro on ro.id = a.room_id
-- left join public.rooms ro2 on ro2.id = r.room_id
-- left join public.rooms ro3 on ro3.id = r.assigned_room_id
-- where a.fire_at > now() - interval '3 days'
-- order by a.fire_at desc;
