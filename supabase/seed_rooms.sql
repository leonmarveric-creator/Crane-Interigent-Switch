-- =============================================================================
--  部屋の一括登録テンプレート
--  使い方: <...> を自分の値に置き換えて、Supabase SQL Editor で Run。
--  ※ 不明な値はとりあえず NULL のままでOK (後から UPDATE できる)。
--  ※ SwitchBot の token/secret はアカウント共通なので、各部屋では NULL にして
--     Vercel の環境変数 (SWITCHBOT_TOKEN / SWITCHBOT_SECRET) に入れるのが推奨。
-- =============================================================================

insert into public.rooms (
  slug,                       -- URL用キー (英数・ハイフン)。例 'ocean-301'
  display_name,               -- 表示名
  airbnb_ical_url,            -- AirbnbのiCal URL (無ければ NULL)
  sesame_device_uuid,         -- セサミ デバイスUUID
  sesame_secret_key,          -- セサミ シークレットキー (32桁hex)
  sesame_api_key,             -- セサミ APIキー (全部屋同じ値でOK)
  switchbot_ac_device_id,     -- SwitchBot エアコン deviceId
  switchbot_light_device_id   -- SwitchBot 照明 deviceId
) values
  -- ───── 部屋1 ─────
  ('room-summer', 'NATU', null,
   '11200420-0708-0822-8E00-8D00FFFFFFFF', 'f4e5e4f67d21074e7bf8865ed8f6f2cf', 'iYnSVw4hfqYxsko9ciqs5IIg9YdlsMQnQgYwqBgH',
   null, null),

  -- ───── 部屋2 ─────
  ('room-autumn', 'AKI', null,
   '11200416-0103-0723-7D00-0D01FFFFFFFF', 'b90a6dbeeb9e37ca9df8aea4430bbf3b', 'iYnSVw4hfqYxsko9ciqs5IIg9YdlsMQnQgYwqBgH',
   null, null),

  -- ───── 部屋3 ─────
  ('room-winter', 'FUYU', null,
   '11200420-0708-0822-8E00-B000FFFFFFFF', '9cfeba4d7e4fbe3f4fe8ef271defbebb', 'iYnSVw4hfqYxsko9ciqs5IIg9YdlsMQnQgYwqBgH',
   null, null),

  -- ───── 部屋4 ─────
  ('room-spring', 'HARU', null,
   '11200420-0708-0822-AD00-F200FFFFFFFF', 'bcd34ead7d583b7268cda11beff09cd8', 'iYnSVw4hfqYxsko9ciqs5IIg9YdlsMQnQgYwqBgH',
   null, null)
;

-- 確認 (シークレット列は伏せて表示)
select slug, display_name,
       sesame_device_uuid is not null as has_lock,
       switchbot_ac_device_id is not null as has_ac
from public.rooms order by slug;

-- -----------------------------------------------------------------------------
-- 後から1部屋だけ値を更新したい場合の例:
-- update public.rooms
--   set sesame_secret_key = '<new_secret>'
--   where slug = '<slug-1>';
-- -----------------------------------------------------------------------------
