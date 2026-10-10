import { useState } from "react";
import { Card } from "./ui";

const DISMISSED_KEY = "cggolf-ios-install-dismissed";

function isStandaloneDisplay(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIOSDevice(): boolean {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS reports itself as a Mac, but has touch support a real Mac doesn't.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isIOSSafari(): boolean {
  // All iOS browsers use WebKit, so check for the other browsers' UA tokens
  // rather than for Safari's -- only Safari can "Add to Home Screen" as a
  // real standalone app; other iOS browsers just bookmark the page.
  return !/crios|fxios|edgios|opios/i.test(navigator.userAgent);
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false; // Private browsing or blocked storage -- just show the tip.
  }
}

/** One-time tip for iOS visitors explaining how to install the PWA, since
 * iOS has no install banner like Android/Chrome -- it only supports
 * installing via Safari's "Add to Home Screen" share-sheet action. */
export function IosInstallHint() {
  const [visible, setVisible] = useState(
    () => !wasDismissed() && isIOSDevice() && !isStandaloneDisplay(),
  );
  const [needsSafari] = useState(() => !isIOSSafari());

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // Nothing to persist to -- it'll just show again next visit.
    }
  }

  return (
    <Card className="mb-4 relative">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-slate-400 text-sm leading-none"
      >
        ✕
      </button>
      <p className="font-semibold text-slate-900 pr-6">📲 Install QWFGolf on your iPhone</p>
      {needsSafari ? (
        <p className="text-sm text-slate-600 mt-1.5">
          Open this page in <strong>Safari</strong> (not Chrome) — then tap the Share icon and
          choose <strong>Add to Home Screen</strong> to install it like an app.
        </p>
      ) : (
        <p className="text-sm text-slate-600 mt-1.5">
          Tap the <strong>Share</strong> icon (square with an arrow pointing up), then choose{" "}
          <strong>Add to Home Screen</strong> to install it like an app — full screen, its own
          icon, no address bar.
        </p>
      )}
    </Card>
  );
}
