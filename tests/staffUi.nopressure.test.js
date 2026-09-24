const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("staff UI: no 'time left' countdown before the next guest (arrival time only)", () => {
  const src = fs.readFileSync(path.join(__dirname, "../components/staff/StaffClient.tsx"), "utf8");
  assert.doesNotMatch(src, /fmtLeft|minsLeft/);
  assert.match(src, /\{t\.nextGuest\} \{fmtDay\(t, effIn\(next\), now\)\} \{jstTime\(effIn\(next\)\)\} \{t\.arrives\}/);
});

const { linenPlan, airbnbCode, weekPlan, DEFAULT_GUESTS } = require("../lib/staffLogic.ts");

test("linen: counts per guest for tomorrow's arrivals, unknown guests use the default", () => {
  assert.equal(airbnbCode("https://www.airbnb.com/hosting/reservations/details/HMABC12345"), "HMABC12345");
  assert.equal(airbnbCode(null), null);
  const rooms = [{ id: "r1", slug: "aki", display_name: "AKI" }, { id: "r2", slug: "haru", display_name: "HARU" }];
  const res = [
    { id: "a", room_id: "r1", guest_name: null, lang: "en", pin: null, status: "active", check_in: "2026-10-02T06:00:00Z", check_out: "2026-10-04T01:00:00Z", early_checkin_at: null, late_checkout_at: null, guests: 3 },
    { id: "b", room_id: "r2", guest_name: null, lang: "en", pin: null, status: "active", check_in: "2026-10-02T06:00:00Z", check_out: "2026-10-03T01:00:00Z", early_checkin_at: null, late_checkout_at: null },
  ];
  const plan = weekPlan(rooms, res, "2026-10-02", 1)[0];
  const l = linenPlan(plan);
  assert.equal(l.totalGuests, 3 + DEFAULT_GUESTS);
  assert.equal(l.anyEstimated, true);
  assert.equal(l.items.find((i) => i.key === "bath").count, 5);
  assert.equal(linenPlan(weekPlan(rooms, res, "2026-10-05", 1)[0]), null);
});

test("staff page looks up Airbnb guest counts by confirmation code", () => {
  const src = fs.readFileSync(path.join(__dirname, "../app/staff/page.tsx"), "utf8");
  assert.match(src, /stays_ext_reservations/);
  assert.match(src, /airbnbCode\(/);
});
