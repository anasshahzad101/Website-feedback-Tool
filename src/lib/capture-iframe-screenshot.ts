import { domToPng } from "modern-screenshot";

/**
 * Capture the live iframe's currently-visible viewport as a base64 PNG.
 * Same-origin only — works because /api/proxy serves at our app origin.
 *
 * Uses modern-screenshot's domToPng: it serializes the DOM into an SVG
 * <foreignObject> and lets the browser rasterize it natively. That means
 * any CSS the browser supports (including lab(), oklch(), oklab(), color()
 * which html2canvas's homegrown parser cannot) renders correctly. The
 * proxy adds Access-Control-Allow-Origin:* on every response so canvas
 * pixels are readable without taint.
 *
 * Returns null if capture fails. Callers must handle that — the comment
 * thread should save without a thumbnail rather than blocking the user.
 */
export async function captureIframeViewport(
  iframe: HTMLIFrameElement | null,
): Promise<string | null> {
  if (typeof window === "undefined") {
    console.warn("[captureIframeViewport] no window (SSR?)");
    return null;
  }
  if (!iframe) {
    console.warn("[captureIframeViewport] iframe ref is null");
    return null;
  }
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win) {
    console.warn("[captureIframeViewport] iframe.contentWindow is null");
    return null;
  }
  if (!doc) {
    console.warn("[captureIframeViewport] iframe.contentDocument is null (cross-origin block?)");
    return null;
  }
  if (!doc.body) {
    console.warn("[captureIframeViewport] iframe doc has no body yet");
    return null;
  }
  try {
    const scrollX = win.scrollX || 0;
    const scrollY = win.scrollY || 0;
    const vw = win.innerWidth;
    const vh = win.innerHeight;
    if (vw <= 0 || vh <= 0) {
      console.warn("[captureIframeViewport] zero viewport dims", { vw, vh });
      return null;
    }
    console.log("[captureIframeViewport] starting modern-screenshot", {
      scrollX,
      scrollY,
      vw,
      vh,
      bodyChildren: doc.body.children.length,
    });

    // domToPng captures the entire body. We crop to the visible viewport
    // afterward via canvas. Pass `filter` to skip cross-origin iframes /
    // script tags (the browser can't access their pixels).
    const fullPng = await domToPng(doc.body, {
      backgroundColor: "#ffffff",
      filter: (el: Element | Node) => {
        if (el instanceof Element) {
          if (el.tagName === "IFRAME" || el.tagName === "SCRIPT") return false;
        }
        return true;
      },
    });

    if (!fullPng) {
      console.warn("[captureIframeViewport] modern-screenshot returned empty");
      return null;
    }

    // Crop to viewport rectangle.
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("captured image failed to load"));
      img.src = fullPng;
    });

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = vw;
    cropCanvas.height = vh;
    const ctx = cropCanvas.getContext("2d");
    if (!ctx) {
      console.warn("[captureIframeViewport] no 2d context");
      return null;
    }
    // Source rect in the full-body capture. img.naturalWidth corresponds to
    // the body's full width; we offset by scroll position to get the visible
    // viewport area.
    ctx.drawImage(
      img,
      scrollX,
      scrollY,
      vw,
      vh,
      0,
      0,
      vw,
      vh,
    );
    const dataUrl = cropCanvas.toDataURL("image/png");
    console.log(
      `[captureIframeViewport] modern-screenshot ok: ${Math.round(dataUrl.length / 1024)}KB`,
    );
    return dataUrl;
  } catch (e) {
    console.error("[captureIframeViewport] modern-screenshot threw:", e);
    return null;
  }
}

/**
 * Compute the pin's position within the cropped viewport image as 0..1
 * fractions. Used to overlay the pin marker on the saved thumbnail.
 */
export function pinFractionsInViewport(
  iframe: HTMLIFrameElement | null,
  docX: number,
  docY: number,
): { x: number; y: number } | null {
  const win = iframe?.contentWindow;
  if (!win) return null;
  const vw = win.innerWidth;
  const vh = win.innerHeight;
  if (vw <= 0 || vh <= 0) return null;
  const x = (docX - (win.scrollX || 0)) / vw;
  const y = (docY - (win.scrollY || 0)) / vh;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}
