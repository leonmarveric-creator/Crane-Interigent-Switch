"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";
import { type Lang } from "@/lib/i18n";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Variant = "tech" | "wafu";

const COPY: Record<Lang, {
  cta: string;
  hint: string;
  done: string;
  title: string;
  body: string;
  ios: string;
  android: string;
  other: string;
  close: string;
}> = {
  ja: {
    cta: "ホーム画面に追加",
    hint: "閉じてもすぐ戻れます",
    done: "追加済み",
    title: "スマホに追加",
    body: "この部屋の操作ページをホーム画面に置くと、ページを閉じてもすぐ開けます。",
    ios: "共有ボタンから「ホーム画面に追加」を選んでください。",
    android: "メニューから「ホーム画面に追加」を選んでください。",
    other: "ブラウザのメニューからホーム画面への追加を選んでください。",
    close: "閉じる",
  },
  en: {
    cta: "Add to Home",
    hint: "Find this room again fast",
    done: "Added",
    title: "Add to your phone",
    body: "Put this room control page on your Home Screen so it is easy to reopen.",
    ios: "Use Share, then choose Add to Home Screen.",
    android: "Use the browser menu, then choose Add to Home Screen.",
    other: "Use your browser menu and choose Add to Home Screen.",
    close: "Close",
  },
  zh: {
    cta: "添加到主屏幕",
    hint: "关闭后也能快速返回",
    done: "已添加",
    title: "添加到手机",
    body: "把此房间的控制页面放到主屏幕，关闭后也能快速打开。",
    ios: "点击分享按钮，然后选择“添加到主屏幕”。",
    android: "打开浏览器菜单，然后选择“添加到主屏幕”。",
    other: "请从浏览器菜单选择添加到主屏幕。",
    close: "关闭",
  },
  ko: {
    cta: "홈 화면에 추가",
    hint: "닫아도 바로 다시 열 수 있어요",
    done: "추가됨",
    title: "스마트폰에 추가",
    body: "이 객실 조작 페이지를 홈 화면에 두면 닫은 뒤에도 쉽게 다시 열 수 있습니다.",
    ios: "공유 버튼을 누른 뒤 홈 화면에 추가를 선택하세요.",
    android: "브라우저 메뉴에서 홈 화면에 추가를 선택하세요.",
    other: "브라우저 메뉴에서 홈 화면에 추가를 선택하세요.",
    close: "닫기",
  },
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function platformInstruction(copy: (typeof COPY)[Lang]) {
  if (typeof navigator === "undefined") return copy.other;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return copy.ios;
  if (/android/i.test(ua)) return copy.android;
  return copy.other;
}

export default function AddToHomePrompt({
  lang,
  roomName,
  variant,
}: {
  lang: Lang;
  roomName: string;
  variant: Variant;
}) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const copy = COPY[lang] ?? COPY.en;
  const instruction = useMemo(() => platformInstruction(copy), [copy]);

  useEffect(() => {
    setInstalled(isStandalone());

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setOpen(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    const originalTitle = document.title;
    const title = `${roomName} | Crane Switch`;
    const start = `${window.location.pathname}${window.location.search}`;
    const manifestHref = `/api/shortcut-manifest?start=${encodeURIComponent(start)}&name=${encodeURIComponent(roomName)}`;
    const manifestLink = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
    const createdManifestLink = !manifestLink;
    const previousManifest = manifestLink?.getAttribute("href") ?? null;
    const targetLink = manifestLink ?? document.head.appendChild(document.createElement("link"));
    const appleTitle = document.querySelector<HTMLMetaElement>("meta[name='apple-mobile-web-app-title']");
    const createdAppleTitle = !appleTitle;
    const previousAppleTitle = appleTitle?.getAttribute("content") ?? null;
    const targetAppleTitle = appleTitle ?? document.head.appendChild(document.createElement("meta"));

    document.title = title;
    targetLink.rel = "manifest";
    targetLink.href = manifestHref;
    targetAppleTitle.name = "apple-mobile-web-app-title";
    targetAppleTitle.content = roomName;

    return () => {
      document.title = originalTitle;
      if (previousManifest) targetLink.href = previousManifest;
      else if (createdManifestLink) targetLink.remove();
      if (previousAppleTitle) targetAppleTitle.content = previousAppleTitle;
      else if (createdAppleTitle) targetAppleTitle.remove();
    };
  }, [roomName]);

  const handleAdd = async () => {
    if (installed) return;
    if (!installPrompt) {
      setOpen(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === "accepted") setInstalled(true);
    else setOpen(true);
  };

  const tech = variant === "tech";
  const buttonClass = tech
    ? "clip-bevel-sm flex w-full items-center gap-3 border border-emerald-400/35 bg-emerald-400/[0.08] px-4 py-3 text-left text-emerald-100 backdrop-blur-xl active:bg-emerald-400/15"
    : "flex w-full items-center gap-3 rounded-lg border border-[#d8cfbb] bg-[#fffdf8]/95 px-4 py-3 text-left text-[#2c2a26] shadow-[0_10px_24px_-22px_rgba(44,42,38,0.45)] active:bg-[#f3efe6]";
  const iconClass = tech
    ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-300/10 text-emerald-200"
    : "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#cfc5b0] bg-[#f4efe6] text-[#6d685d]";
  const hintClass = tech ? "text-[11px] text-white/45" : "text-[11px] text-[#7d7465]";
  const modalClass = tech
    ? "border-cyan-300/25 bg-[#08101c]/95 text-white"
    : "border-[#d8cfbb] bg-[#fffdf8] text-[#2c2a26]";

  return (
    <>
      <button onClick={handleAdd} className={buttonClass}>
        <span className={iconClass}>
          {installed ? <Smartphone className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{installed ? copy.done : copy.cta}</span>
          <span className={`block ${hintClass}`}>{copy.hint}</span>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/45 px-4 pb-4 backdrop-blur-sm sm:items-center sm:justify-center sm:pb-0">
          <div className={`w-full max-w-sm rounded-xl border p-4 shadow-2xl ${modalClass}`}>
            <div className="flex items-start gap-3">
              <span className={iconClass}>
                <Share2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">{copy.title}</p>
                <p className={`mt-1 text-sm leading-relaxed ${tech ? "text-white/62" : "text-[#6d685d]"}`}>{copy.body}</p>
                <p className={`mt-3 rounded-lg border px-3 py-2 text-sm leading-relaxed ${tech ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100" : "border-[#ded6c7] bg-[#f7f4ed] text-[#4d473d]"}`}>
                  {instruction}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tech ? "bg-white/10 text-white/70" : "bg-[#f4efe6] text-[#6d685d]"}`}
                aria-label={copy.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
