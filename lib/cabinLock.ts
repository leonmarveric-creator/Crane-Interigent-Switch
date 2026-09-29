/**
 * 車内 iPad: お部屋の鍵 (内側のつまみ) の使い方ガイド。春・秋・冬のお部屋 (到着画面のボタンで。自動では流さない)。
 *   ⓪ 外から開ける: 暗証番号 → 右下の解錠キー (夏と同じテンキー)。お部屋のドアは自動では鍵がかからない
 *   ① 閉める: ドアを閉めてから、つまみを右へ (時計回り) → 縦 = 施錠
 *   ② 開ける: つまみを左へ (反時計回り) → 横 = 解錠
 *   ③ まとめ: 縦 = 🔒 / 横 = 🔓・右で閉める / 左で開ける (エントランスは逆)
 *   声: public/cabin/audio/ai/lock-<key>.mp3 (ASTRAEA・英語)。字幕と画面の文字はゲストの言語。
 *   写真: public/cabin/img/lock-{l1,l2,l3,u1,u2,u3}.webp (オーナーが用意した実物の写真)
 */
import type { GLang } from "@/lib/cabinGeo";

type Line = Record<GLang, string>;
export type LockKey = "intro" | "k0" | "k1" | "k2" | "sum";
export const LOCK_VOICE: Record<LockKey, Line> = {
  intro: { en: "Now, your room lock. One knob, two positions. Even I can't get this wrong.", ja: "続いて、お部屋の鍵です。つまみがひとつ、向きはふたつ。私でも間違えません。", zh: "接下来是房间的门锁。一个旋钮，两个方向。连我都不会弄错。", ko: "이어서 객실 도어록이에요. 손잡이 하나, 방향은 둘. 저도 틀릴 수 없어요." },
  k0: { en: "From outside, enter your room code on the keypad, then press the unlock key at the bottom right. One thing to know: this door does not lock by itself.", ja: "外から開けるときは、テンキーでお部屋の暗証番号を入力し、右下の解錠キーを押します。ひとつ大事なこと。このドアは、自動では鍵がかかりません。", zh: "从外面开门时，在密码键盘输入房间密码，再按右下角的解锁键。有一点很重要：这扇门不会自动上锁。", ko: "밖에서 열 때는 키패드에 객실 비밀번호를 입력하고, 오른쪽 아래 잠금 해제 키를 누르세요. 중요한 점 하나. 이 문은 자동으로 잠기지 않아요." },
  k1: { en: "To lock, close the door first. Then turn the knob to the right, clockwise, until it stands upright. Vertical means locked.", ja: "鍵をかけるときは、まずドアを閉めます。それから、つまみを右へ、時計回りに、縦になるまで回します。縦は施錠です。", zh: "上锁时，请先关好门。然后把旋钮向右、顺时针转到竖直。竖着就是已上锁。", ko: "잠글 때는 먼저 문을 닫으세요. 그다음 손잡이를 오른쪽으로, 시계 방향으로 세로가 될 때까지 돌리세요. 세로는 잠김이에요." },
  k2: { en: "To unlock, turn the knob to the left, counterclockwise, until it lies flat. Horizontal means unlocked. Then open the door.", ja: "開けるときは、つまみを左へ、反時計回りに、横になるまで回します。横は解錠です。それからドアを開けます。", zh: "开锁时，把旋钮向左、逆时针转到水平。横着就是已开锁。然后再开门。", ko: "열 때는 손잡이를 왼쪽으로, 시계 반대 방향으로 가로가 될 때까지 돌리세요. 가로는 잠금 해제예요. 그다음 문을 여세요." },
  sum: { en: "In short: upright, locked. Flat, open. Right to lock, left to open. The entrance works the other way around. Doors have personalities.", ja: "まとめです。縦は施錠、横は解錠。右で閉めて、左で開ける。エントランスは逆なのでご注意を。ドアにも個性があります。", zh: "总结一下：竖着是上锁，横着是开锁。向右锁上，向左打开。入口的方向正好相反，请注意。门也是有个性的。", ko: "정리할게요. 세로는 잠김, 가로는 열림. 오른쪽으로 잠그고, 왼쪽으로 열어요. 입구는 반대니 주의하세요. 문에도 개성이 있어요." },
};
export const lockAudio = (k: LockKey) => `/cabin/audio/ai/lock-${k}.mp3`;
export const LOCK_IMG = { l1: "/cabin/img/lock-l1.webp", l2: "/cabin/img/lock-l2.webp", l3: "/cabin/img/lock-l3.webp", u1: "/cabin/img/lock-u1.webp", u2: "/cabin/img/lock-u2.webp", u3: "/cabin/img/lock-u3.webp" };

/** この鍵 (内側のつまみ) のお部屋: Crane Nest の春・秋・冬 */
export const hasRoomLock = (slug: string | null | undefined) => /spring|haru|autumn|aki|winter|fuyu/i.test(String(slug || ""));

export const LOCK_T: Record<GLang, Record<string, string>> = {
  ja: { top: "お部屋の鍵", btn: "お部屋の鍵の使い方", t0: "外から開ける", d0: "お部屋の暗証番号を入力し、右下の解錠キーを押します。", noauto: "⚠ 自動では鍵がかかりません", c0: "番号 → 右下の解錠キー", t1: "鍵をかける", d1: "ドアを閉めてから、つまみを右へ回して縦にします。", first: "先にドアを閉める", t2: "鍵を開ける", d2: "つまみを左へ回して横にします。", open: "横 = 解錠", lock: "縦 = 施錠", right: "右へ回す", left: "左へ回す", c1: "ドアを閉めて → 右へ → 縦", c2: "左へ → 横", c3: "縦は施錠・横は解錠", ent: "※ エントランスは向きが逆です", s1: "解錠中", s2: "回す", s3: "施錠" },
  zh: { top: "房间门锁", btn: "房间门锁怎么用", t0: "从外面开门", d0: "输入房间密码，再按右下角的解锁键。", noauto: "⚠ 不会自动上锁", c0: "密码 → 右下角解锁键", t1: "上锁", d1: "先关好门，再把旋钮向右转到竖直。", first: "请先关好门", t2: "开锁", d2: "把旋钮向左转到水平。", open: "横 = 已开锁", lock: "竖 = 已上锁", right: "向右转", left: "向左转", c1: "关门 → 向右转 → 竖直", c2: "向左转 → 水平", c3: "竖着上锁・横着开锁", ent: "※ 入口的方向正好相反", s1: "已开锁", s2: "旋转", s3: "已上锁" },
  en: { top: "ROOM LOCK", btn: "Your room lock", t0: "Open from outside", d0: "Enter your room code, then press the bottom-right unlock key.", noauto: "⚠ Does not lock automatically", c0: "Code → bottom-right unlock key", t1: "Lock", d1: "Close the door, then turn the knob right until it is vertical.", first: "Close the door first", t2: "Unlock", d2: "Turn the knob left until it is horizontal.", open: "Horizontal = open", lock: "Vertical = locked", right: "Turn right", left: "Turn left", c1: "Close door → turn right → vertical", c2: "Turn left → horizontal", c3: "Vertical locked · horizontal open", ent: "* The entrance works the other way", s1: "UNLOCKED", s2: "TURN", s3: "LOCKED" },
  ko: { top: "객실 도어록", btn: "객실 도어록 사용법", t0: "밖에서 열기", d0: "객실 비밀번호를 입력하고 오른쪽 아래 잠금 해제 키를 누르세요.", noauto: "⚠ 자동으로 잠기지 않아요", c0: "비밀번호 → 오른쪽 아래 해제 키", t1: "잠그기", d1: "문을 닫은 뒤, 손잡이를 오른쪽으로 돌려 세로로 하세요.", first: "먼저 문을 닫으세요", t2: "열기", d2: "손잡이를 왼쪽으로 돌려 가로로 하세요.", open: "가로 = 열림", lock: "세로 = 잠김", right: "오른쪽으로", left: "왼쪽으로", c1: "문 닫기 → 오른쪽 → 세로", c2: "왼쪽 → 가로", c3: "세로 잠김・가로 열림", ent: "※ 입구는 방향이 반대예요", s1: "잠금 해제", s2: "돌리기", s3: "잠김" },
};
