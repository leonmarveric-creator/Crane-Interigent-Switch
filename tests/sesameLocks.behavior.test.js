const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const qrPath = path.join(root, "lib", "sesameQr.ts");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");

const SECRET = "00112233445566778899aabbccddeeff";
const UUID_HEX = "0b1c2d3e4f5061728394a5b6c7d8e9f0";
function shareLink(len, uuidAt, name) {
  const b = Buffer.alloc(len, 0x7f);
  b[0] = 5;
  Buffer.from(SECRET, "hex").copy(b, 1);
  Buffer.from(UUID_HEX, "hex").copy(b, uuidAt);
  const sk = b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `ssm://UI?t=sk&sk=${sk}&l=0&n=${encodeURIComponent(name)}`;
}

test("reads secret key and UUID from a 99-byte share QR", async () => {
  const { parseSesameQr } = await import(qrPath);
  const r = parseSesameQr(shareLink(99, 83, "HARU ドア"));
  assert.equal(r.secretKey, SECRET);
  assert.equal(r.deviceUuid, "0B1C2D3E-4F50-6172-8394-A5B6C7D8E9F0");
  assert.equal(r.name, "HARU ドア");
  assert.equal(r.format, "99");
});

test("reads the short 39-byte format and the secret-only 16-byte format", async () => {
  const { parseSesameQr } = await import(qrPath);
  assert.equal(parseSesameQr(shareLink(39, 23, "Bot")).deviceUuid, "0B1C2D3E-4F50-6172-8394-A5B6C7D8E9F0");
  const sk = Buffer.from(SECRET, "hex").toString("base64");
  const r = parseSesameQr(`ssm://UI?t=sk&sk=${encodeURIComponent(sk)}`);
  assert.equal(r.secretKey, SECRET);
  assert.equal(r.deviceUuid, null);
  assert.equal(parseSesameQr("hello"), null);
  assert.equal(parseSesameQr(""), null);
});

test("a rendered QR image decodes back to the same lock (jsQR)", async () => {
  const QR = require("qrcode");
  const jsQR = require("jsqr");
  const { parseSesameQr } = await import(qrPath);
  const link = shareLink(99, 83, "Entrance");
  const q = QR.create(link, { errorCorrectionLevel: "M" });
  const n = q.modules.size, scale = 6, pad = 4 * scale, w = n * scale + pad * 2;
  const px = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!q.modules.get(y, x)) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = ((pad + y * scale + dy) * w + (pad + x * scale + dx)) * 4;
      px[i] = px[i + 1] = px[i + 2] = 0;
    }
  }
  const hit = jsQR(px, w, w);
  assert.equal(hit.data, link);
  assert.equal(parseSesameQr(hit.data).secretKey, SECRET);
});

test("migration imports existing room and entrance locks; assignment copies credentials", () => {
  const sql = read("supabase", "migration_sesame_locks.sql");
  assert.match(sql, /create table if not exists public\.sesame_locks/);
  assert.match(sql, /insert into public\.sesame_locks[\s\S]*from public\.rooms/);
  assert.match(sql, /update public\.rooms r\s+set sesame_lock_id/);
  assert.match(sql, /from public\.entrances/);
  const actions = read("app", "admin", "sesameActions.ts");
  assert.match(actions, /sesame_secret_key: l\?\.secret_key/);
  assert.match(read("app", "admin", "page.tsx"), /has_secret: !!l\.secret_key/);
  assert.doesNotMatch(read("app", "admin", "page.tsx"), /secret_key: l\.secret_key/);
});

test("a share link whose '+' turned into a space still decodes (Sesame 5, 39 bytes)", async () => {
  const { parseSesameQr } = await import(qrPath);
  const b = Buffer.alloc(39, 0xfb); b[0] = 5;
  Buffer.from(SECRET, "hex").copy(b, 1);
  Buffer.from("11200416010307016c00ffffffffffff", "hex").copy(b, 23);
  const sk = b.toString("base64");
  assert.ok(sk.includes("+") || sk.includes("/"));
  const r = parseSesameQr(`ssm://UI?t=sk&sk=${sk.replace(/\+/g, " ")}&l=0&n=%F0%9F%90%AC2F`);
  assert.equal(r.secretKey, SECRET);
  assert.equal(r.deviceUuid, "11200416-0103-0701-6C00-FFFFFFFFFFFF");
  assert.equal(r.model, 5);
});
