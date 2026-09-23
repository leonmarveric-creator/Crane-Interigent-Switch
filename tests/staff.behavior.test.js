const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const logic = path.join(root, "lib", "staffLogic.ts");
const stay = path.join(root, "lib", "stayTimes.ts");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const J = (s) => new Date(`${s}+09:00`).toISOString(); // 日本時間 → ISO

const room = { id: "haru", slug: "room-haru", name: "HARU", building: "Crane Nest", cleaned_at: null, has_lock: true };
const res = (o) => ({ id: "r", room_id: "haru", guest_name: null, lang: "en", pin: "1234", status: "active",
  check_in: J("2026-09-23T15:00:00"), check_out: J("2026-09-25T10:00:00"), early_checkin_at: null, late_checkout_at: null, ...o });

test("room status: staying / dirty until cleaned / vacant", async () => {
  const { roomState } = await import(logic);
  const prev = res({ id: "p", check_in: J("2026-09-21T15:00:00"), check_out: J("2026-09-23T10:00:00") });
  const next = res({ id: "n" });
  const at = (s) => new Date(J(s)).getTime();
  assert.equal(roomState(room, [prev, next], at("2026-09-22T12:00:00")).status, "staying");
  const st = roomState(room, [prev, next], at("2026-09-23T11:00:00"));
  assert.equal(st.status, "dirty");
  assert.equal(st.next.id, "n");
  assert.equal(roomState({ ...room, cleaned_at: J("2026-09-23T12:00:00") }, [prev, next], at("2026-09-23T12:30:00")).status, "vacant");
  // 早期チェックインが入ると、その時刻から滞在中
  const early = { ...next, early_checkin_at: J("2026-09-23T13:00:00") };
  assert.equal(roomState({ ...room, cleaned_at: J("2026-09-23T12:00:00") }, [prev, early], at("2026-09-23T13:30:00")).status, "staying");
});

test("early check-in must be earlier and not overlap the previous guest", async () => {
  const { planEarlyCheckin } = await import(logic);
  const prev = res({ id: "p", guest_name: "KIM", check_in: J("2026-09-21T15:00:00"), check_out: J("2026-09-23T10:00:00") });
  const me = res({ id: "me" });
  const ok = planEarlyCheckin(me, "13:00", [prev, me]);
  assert.equal(ok.ok, true);
  assert.equal(ok.at, J("2026-09-23T13:00:00"));
  assert.equal(planEarlyCheckin(me, "16:00", [me]).error, "NOT_EARLIER");
  const lateprev = { ...prev, late_checkout_at: J("2026-09-23T14:00:00") };
  const bad = planEarlyCheckin(me, "13:00", [lateprev, me]);
  assert.equal(bad.error, "OVERLAP_PREV");
  assert.equal(bad.conflict.guest_name, "KIM");
});

test("late check-out must be later and not overlap the next guest", async () => {
  const { planLateCheckout } = await import(logic);
  const me = res({ id: "me" });
  const next = res({ id: "n", check_in: J("2026-09-25T15:00:00"), check_out: J("2026-09-27T10:00:00") });
  assert.equal(planLateCheckout(me, "12:00", [me, next]).ok, true);
  assert.equal(planLateCheckout(me, "09:00", [me]).error, "NOT_LATER");
  const earlyNext = { ...next, early_checkin_at: J("2026-09-25T11:00:00") };
  assert.equal(planLateCheckout(me, "12:00", [me, earlyNext]).error, "OVERLAP_NEXT");
});

test("week plan counts cleanings and turnovers per day", async () => {
  const { weekPlan } = await import(logic);
  const prev = res({ id: "p", check_in: J("2026-09-21T15:00:00"), check_out: J("2026-09-23T10:00:00") });
  const next = res({ id: "n" });
  const plan = weekPlan([room], [prev, next], "2026-09-23", 3);
  assert.equal(plan[0].cleanings, 1);
  assert.equal(plan[0].rooms[0].turnover, true);
  assert.equal(plan[2].rooms[0].out.id, "n");
});

test("guest message includes the early time, PIN and entrance link in the guest's language", async () => {
  const { guestMessage } = await import(logic);
  const m = guestMessage({ lang: "zh", guestName: "CHEN", roomName: "HARU", checkIn: J("2026-09-23T13:00:00"),
    checkOut: J("2026-09-25T10:00:00"), early: true, late: false, pin: "5678",
    entranceUrl: "https://x/key/crane-nest", roomUrl: "https://x/room/room-haru" });
  assert.match(m, /今天 13:00 起即可入住/);
  assert.match(m, /5678/);
  assert.match(m, /https:\/\/x\/key\/crane-nest/);
  assert.match(guestMessage({ lang: "en", guestName: null, roomName: "HARU", checkIn: J("2026-09-23T15:00:00"),
    checkOut: J("2026-09-25T12:00:00"), early: false, late: true, pin: null, entranceUrl: null, roomUrl: "u" }), /Late check-out is confirmed until 12:00/);
});

test("effective stay times drive room access, entrance and checkout cleanup", async () => {
  const { withEffectiveTimes, isStayingAt } = await import(stay);
  const r = { check_in: J("2026-09-23T15:00:00"), check_out: J("2026-09-25T10:00:00"), early_checkin_at: J("2026-09-23T12:00:00"), late_checkout_at: null };
  assert.equal(withEffectiveTimes(r).check_in, J("2026-09-23T12:00:00"));
  assert.equal(isStayingAt(r, new Date(J("2026-09-23T12:30:00")).getTime()), true);
  assert.match(read("lib", "auth.ts"), /isStayingAt\(r, now\)/);
  assert.match(read("app", "api", "key", "[entrance]", "verify", "route.ts"), /withEffectiveTimes/);
  assert.match(read("lib", "syncIcal.ts"), /effectiveOut\(r\)/);
  assert.match(read("middleware.ts"), /\/staff\/login/);
  assert.match(read("app", "staff", "actions.ts"), /requireStaff\(\)/);
});

test("daily cheer changes by date (stable within a day) and progress counts today's cleanings", async () => {
  const { dailyCheer, doneCheer, allDoneCheer } = await import(path.join(root, "lib", "staffCheer.ts"));
  assert.equal(dailyCheer("2026-09-23", "zh"), dailyCheer("2026-09-23", "zh"));
  assert.notEqual(dailyCheer("2026-09-23", "zh"), dailyCheer("2026-09-24", "zh"));
  assert.notEqual(dailyCheer("2026-09-23", "zh"), dailyCheer("2026-09-23", "ja"));
  assert.ok(doneCheer("zh", 0).length > 0);
  assert.match(allDoneCheer("zh"), /全部完成/);
  assert.match(allDoneCheer("zh", "2026-09-24"), /全部完成/);
  const { todayCleaning } = await import(logic);
  const prev = res({ id: "p", check_in: J("2026-09-21T15:00:00"), check_out: J("2026-09-23T10:00:00") });
  const now = new Date(J("2026-09-23T12:00:00")).getTime();
  assert.deepEqual(todayCleaning([room], [prev], now), { total: 1, done: 0 });
  assert.deepEqual(todayCleaning([{ ...room, cleaned_at: J("2026-09-23T11:30:00") }], [prev], now), { total: 1, done: 1 });
});

test("staff can switch room lights and turn everything off + lock", () => {
  const a = read("app", "staff", "actions.ts");
  assert.match(a, /export async function roomLights/);
  assert.match(a, /export async function roomAllOff/);
  assert.match(a, /"good_night"/);
  assert.match(read("components", "staff", "StaffClient.tsx"), /hello: "Xiaobo"/);
});

test("forgot to press 清扫完成? the room counts as cleaned once check-in time comes", async () => {
  const { roomState, todayCleaning, autoCleanTime } = await import(logic);
  const at = (s) => new Date(J(s)).getTime();
  const prev = res({ id: "p", check_in: J("2026-09-21T15:00:00"), check_out: J("2026-09-23T10:00:00") });
  // 次の予約なし → 退室日の 15:00 で自動完了
  assert.equal(roomState(room, [prev], at("2026-09-23T14:59:00")).status, "dirty");
  const s = roomState(room, [prev], at("2026-09-23T15:00:00"));
  assert.equal(s.status, "vacant");
  assert.equal(s.autoCleanedAt, J("2026-09-23T15:00:00"));
  // 次のゲストが早期 13:00 → 13:00 で自動完了 (そのまま滞在中になる)
  const early = res({ id: "n", early_checkin_at: J("2026-09-23T13:00:00") });
  assert.equal(autoCleanTime(prev, early), J("2026-09-23T13:00:00"));
  // 進み具合も自動完了を「済み」に数える
  assert.deepEqual(todayCleaning([room], [prev], at("2026-09-23T16:00:00")), { total: 1, done: 1 });
  assert.deepEqual(todayCleaning([room], [prev], at("2026-09-23T12:00:00")), { total: 1, done: 0 });
});

test("daily cheer is different on every day of a whole (leap) year, in both languages", async () => {
  const { dailyCheer } = await import(path.join(root, "lib", "staffCheer.ts"));
  const zh = new Set(), ja = new Set();
  let n = 0;
  for (let t = Date.UTC(2028, 0, 1); t < Date.UTC(2029, 0, 1); t += 86400e3, n++) {
    const d = new Date(t).toISOString().slice(0, 10);
    zh.add(dailyCheer(d, "zh")); ja.add(dailyCheer(d, "ja"));
  }
  assert.equal(n, 366);
  assert.equal(zh.size, 366);
  assert.equal(ja.size, 366);
  // 「换一句」で別の言葉になる
  assert.notEqual(dailyCheer("2026-09-23", "zh", 1), dailyCheer("2026-09-23", "zh"));
});

test("special days: Mother's Day, lunar festivals, and ordinary days", async () => {
  const { specialDay } = await import(path.join(root, "lib", "staffCheer.ts"));
  assert.match(specialDay("2027-05-09", "zh").text, /母亲节/);   // 5月第2日曜
  assert.equal(specialDay("2027-05-02", "zh"), null);
  assert.match(specialDay("2026-09-25", "zh").text, /中秋/);
  assert.match(specialDay("2027-02-06", "ja").text, /春節/);
  assert.equal(specialDay("2026-09-23", "zh"), null);
});

test("room icons follow the room name, with a stable fallback", async () => {
  const { roomIcon } = await import(logic);
  assert.equal(roomIcon({ slug: "room-haru", name: "HARU" }).emoji, "🌸");
  assert.equal(roomIcon({ slug: "room-summer", name: "夏" }).emoji, "🌻");
  assert.equal(roomIcon({ slug: "room-take", name: "TAKE" }).emoji, "🎋");
  assert.equal(roomIcon({ slug: "room-ni", name: "NI" }).emoji, "🪷");
  const a = roomIcon({ slug: "room-501", name: "501" });
  assert.deepEqual(roomIcon({ slug: "room-501", name: "501" }), a);
});

test("achievements count cleaned rooms, welcomed guests and monthly stamps", async () => {
  const { achievements } = await import(logic);
  const { badgeProgress } = await import(path.join(root, "lib", "staffCheer.ts"));
  const h = (i, o) => ({ in: J(i), out: J(o) });
  const hist = [
    h("2026-08-30T15:00:00", "2026-09-02T10:00:00"),
    h("2026-09-10T15:00:00", "2026-09-12T10:00:00"),
    h("2026-09-22T15:00:00", "2026-09-25T10:00:00"), // まだ滞在中
  ];
  const a = achievements(hist, new Date(J("2026-09-23T12:00:00")).getTime());
  assert.equal(a.monthCleans, 2);
  assert.equal(a.yearCleans, 2);
  assert.equal(a.monthGuests, 2);
  assert.equal(a.yearGuests, 3);
  assert.deepEqual(a.stampDays, [2, 12]);
  assert.equal(a.daysInMonth, 30);
  assert.equal(a.firstWeekday, 2); // 2026-09-01 は火曜
  const bp = badgeProgress(7);
  assert.equal(bp.earned.length, 1);
  assert.equal(bp.left, 3);
});

test("Face ID / passkey login: registration needs a staff session, login issues the same staff cookie", () => {
  const regOpt = read("app", "api", "staff", "passkey", "register", "options", "route.ts");
  const regVer = read("app", "api", "staff", "passkey", "register", "verify", "route.ts");
  const logVer = read("app", "api", "staff", "passkey", "login", "verify", "route.ts");
  assert.match(regOpt, /if \(!isStaff\(\)\)/);
  assert.match(regVer, /if \(!isStaff\(\)\)/);
  assert.match(regVer, /requireUserVerification: true/);
  assert.match(logVer, /requireUserVerification: true/);
  assert.match(logVer, /setStaffCookie\(res\)/);
  assert.match(read("lib", "staffPasskey.ts"), /readChallenge[\s\S]*timingSafeEqual/);
  assert.match(read("supabase", "migration_staff_passkeys.sql"), /enable row level security/);
});

test("staff images are not blocked by the login redirect (login page shows the illustration)", () => {
  const m = read("middleware.ts");
  assert.match(m, /isStaticFile = \/\\\.\(\?:jpg\|jpeg\|png/);
  assert.match(m, /!isStaticFile\)/);
});

test("staff login accepts letters (no numeric-only keyboard) and reports a missing STAFF_PASSWORD", () => {
  const page = read("app", "staff", "login", "page.tsx");
  assert.doesNotMatch(page, /inputMode="numeric"/);
  assert.doesNotMatch(page, /-mt-6/);
  const route = read("app", "api", "staff", "login", "route.ts");
  assert.match(route, /NOT_CONFIGURED/);
  assert.match(route, /password\.trim\(\) !== \(process\.env\.STAFF_PASSWORD \?\? ""\)\.trim\(\)/);
});

test("home-screen shortcut for /staff opens /staff (own manifest + icons), not /admin", () => {
  const m = JSON.parse(read("public", "staff", "manifest.webmanifest"));
  assert.equal(m.start_url, "/staff");
  assert.equal(m.scope, "/staff");
  assert.match(read("app", "staff", "layout.tsx"), /manifest: "\/staff\/manifest\.webmanifest"/);
  assert.ok(!fs.existsSync(path.join(root, "app", "manifest.ts"))); // ファイル規約だと上書きできない
  assert.match(read("middleware.ts"), /webmanifest\)\$/);
  assert.ok(fs.existsSync(path.join(root, "public", "staff", "apple-touch-icon.png")));
});
