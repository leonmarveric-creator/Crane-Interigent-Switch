/**
 * 車内 iPad: トイレの使い方ガイド (押したときだけ流れる)。
 *   ① 流すときは壁のボタン → ② 温水洗浄便座 (座ってから) → ③ UV 殺菌灯 (さわらない・電源を入れない・目に有害) → 終わり
 *   声: public/cabin/audio/ai/toilet-<key>.mp3 (ASTRAEA・英語)。字幕と画面の文字はゲストの言語。
 */
import type { GLang } from "@/lib/cabinGeo";

type Line = Record<GLang, string>;
export type ToiletKey = "intro" | "t1" | "t2" | "t3" | "end";
export const TOILET_VOICE: Record<ToiletKey, Line> = {
  intro: { en: "A short briefing on the restroom. Japanese toilets are very advanced. Almost as advanced as me.", ja: "トイレについて、簡単にご説明します。日本のトイレはとても高性能です。私とほぼ同じくらいに。", zh: "简单介绍一下卫生间。日本的马桶非常先进，几乎和我一样先进。", ko: "화장실에 대해 간단히 안내해 드릴게요. 일본 화장실은 아주 첨단이에요. 거의 저만큼요." },
  t1: { en: "To flush, press the square button on the wall behind the toilet. One push is enough. It hears you the first time.", ja: "流すときは、トイレ奥の壁にある四角いボタンを押してください。1 回で十分です。ちゃんと一度で聞こえています。", zh: "冲水时，请按马桶后方墙上的方形按钮。按一次就够了，它第一次就听见了。", ko: "물을 내릴 때는 변기 뒤쪽 벽에 있는 네모난 버튼을 누르세요. 한 번이면 충분해요. 한 번에 잘 들려요." },
  t2: { en: "The seat has a warm-water bidet. Please sit down before using it. Pressing buttons while standing leads to surprising results.", ja: "便座には温水洗浄機能が付いています。必ず座ってからお使いください。立ったままボタンを押すと、驚きの結果になります。", zh: "马桶座带有温水洗净功能。请务必坐下后再使用。站着按按钮，结果会很惊人。", ko: "변기에는 비데가 달려 있어요. 꼭 앉은 다음에 사용해 주세요. 서서 버튼을 누르면 놀라운 결과가 생겨요." },
  t3: { en: "You may see a blue lamp. It's a UV sterilizer. It cleans the restroom automatically when no one is inside. Please don't touch it or switch it on. UV light is harmful to eyes and skin. It works best alone. Like me, at three a.m.", ja: "青いランプは紫外線の殺菌灯です。誰もいないときに自動でトイレを殺菌します。さわったり、電源を入れたりしないでください。紫外線は目や肌に有害です。ひとりのときに一番よく働きます。深夜 3 時の私のように。", zh: "蓝色的灯是紫外线消毒灯。没有人的时候会自动为卫生间消毒。请不要触摸，也不要打开电源。紫外线对眼睛和皮肤有害。它独处时工作最好。就像凌晨三点的我。", ko: "파란 램프는 자외선 살균기예요. 아무도 없을 때 자동으로 화장실을 살균해요. 만지거나 전원을 켜지 마세요. 자외선은 눈과 피부에 해로워요. 혼자 있을 때 가장 일을 잘해요. 새벽 3시의 저처럼요." },
  end: { en: "That's all. Enjoy your stay. The restroom thanks you in advance.", ja: "以上です。どうぞごゆっくり。トイレに代わって、先にお礼を申し上げます。", zh: "就这些。祝您入住愉快。我代表卫生间提前向您致谢。", ko: "이상이에요. 편히 쉬세요. 화장실을 대신해 미리 감사드려요." },
};
export const toiletAudio = (k: ToiletKey) => `/cabin/audio/ai/toilet-${k}.mp3`;

export const TOILET_T: Record<GLang, Record<string, string>> = {
  ja: { top: "トイレの使い方", t1: "流すときはボタン", d1: "トイレ奥の壁にある四角いボタンを押すと、水が流れます。", push: "押す", t2: "温水洗浄便座つき", d2: "必ず座ってからお使いください。", sit: "座ってから", t3: "UV 殺菌灯", d3: "誰もいないときに自動で殺菌します。", w1: "さわらない", w2: "電源を入れない", w3: "目・肌に有害", auto: "無人のとき自動", c1: "壁の四角いボタンを押す", c2: "座ってから使う", c3: "さわらない・電源を入れない", q: "トイレの使い方" },
  zh: { top: "卫生间使用指南", t1: "按按钮冲水", d1: "按马桶后方墙上的方形按钮即可冲水。", push: "按下", t2: "配有温水洗净便座", d2: "请务必坐下后再使用。", sit: "坐下后使用", t3: "紫外线消毒灯", d3: "无人时自动消毒。", w1: "请勿触摸", w2: "请勿启动", w3: "对眼睛和皮肤有害", auto: "无人时自动", c1: "按墙上的方形按钮", c2: "坐下后使用", c3: "请勿触摸・请勿启动", q: "卫生间怎么用" },
  en: { top: "RESTROOM GUIDE", t1: "Press to flush", d1: "Press the square button on the wall behind the toilet.", push: "PUSH", t2: "Bidet toilet seat", d2: "Please sit down before using it.", sit: "SIT FIRST", t3: "UV sterilizer", d3: "It disinfects automatically when no one is inside.", w1: "Do not touch", w2: "Do not turn on", w3: "Harmful to eyes & skin", auto: "AUTO · WHEN EMPTY", c1: "Press the square wall button", c2: "Sit down before using", c3: "Don't touch · don't turn on", q: "How to use the restroom" },
  ko: { top: "화장실 이용 안내", t1: "버튼을 눌러 물 내리기", d1: "변기 뒤쪽 벽의 네모난 버튼을 누르면 물이 내려가요.", push: "누르기", t2: "비데 설치", d2: "꼭 앉은 다음에 사용해 주세요.", sit: "앉은 후 사용", t3: "자외선 살균기", d3: "아무도 없을 때 자동으로 살균해요.", w1: "만지지 마세요", w2: "작동하지 마세요", w3: "눈・피부에 해로움", auto: "무인 시 자동", c1: "벽의 네모난 버튼 누르기", c2: "앉은 후 사용", c3: "만지지 말고 켜지 마세요", q: "화장실 사용법" },
};
