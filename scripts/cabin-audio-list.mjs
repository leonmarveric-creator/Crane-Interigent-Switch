// 車内の声・効果音の一覧 (public/cabin/audio/list.json) を作る。声を足したり差し替えたら実行: node scripts/cabin-audio-list.mjs
// お父さんのスマホは、この一覧を見て声を先に保存する (v が変わったら保存し直す)
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const root = path.join(process.cwd(), "public", "cabin", "audio");
const out = [];
const walk = (d) => { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== "boost") walk(p); } else if (f.endsWith(".mp3")) out.push(p); } };
walk(root);
const h = crypto.createHash("sha1");
const files = out.map((p) => { h.update(p.slice(root.length)); h.update(fs.readFileSync(p)); return "/cabin/audio" + p.slice(root.length).split(path.sep).join("/"); });
fs.writeFileSync(path.join(root, "list.json"), JSON.stringify({ v: h.digest("hex").slice(0, 12), files }) + "\n");
console.log(files.length, "files");
