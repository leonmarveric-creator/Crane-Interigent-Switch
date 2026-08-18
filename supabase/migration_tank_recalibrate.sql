-- =============================================================================
--  便槽タンク 再較正（実測反映）
--    実質容量 300L / 簡易水洗 3.0L・人泊 に更新する。
--    ※ 匂いライン(≈270L=90%)・警告(通常240L/夏210L)・注意(通常210L/夏180L)は
--      アプリ側(lib/stays/tank.ts)で自動計算するため、ここでは容量と1人あたり量のみ更新。
--    ※ liters_per_guest は実際の汲み取り間隔で較正するのが最も正確:
--        実測L/人 = 270L ÷ (前回汲み取りから匂いが出るまでの延べ人泊)
-- =============================================================================
update public.stays_tank_state
  set capacity_liters = 300,
      liters_per_guest = 3.0,
      updated_at = now()
  where id = 1;

select id, capacity_liters, liters_per_guest, last_emptied_date from public.stays_tank_state;
