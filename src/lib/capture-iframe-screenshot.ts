import { domToPng } from "modern-screenshot";

/**
 * Capture the live iframe's currently-visible viewport as a base64 PNG.
 * Same-origin only — works because /api/proxy serves at our app origin.
 *
 * Strategy: capture the full body (modern-screenshot inlines styles itself),
 * then crop to the viewport rectangle the user was actually looking at via
 * a 2D canvas. Returns null if anything fails — callers must handle that
 * (the comment thread saves without an attachment).
 */
export async function captureIframeViewport(
  iframe: HTMLIFrameElement | null,
): Promise<string | null> {
  if (!iframe) return null;
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc || !doc.body) return null;
  try {
    const dpr = win.devicePixelRatio || 1;
    const scrollX = win.scrollX || 0;
    const scrollY = win.scrollY || 0;
    const vw = win.innerWidth;
    const vh = win.innerHeight;
    if (vw <= 0 || vh <= 0) return null;

    // Capture the full body. modern-screenshot inlines stylesheets and walks
    // the DOM into an SVG that's rasterized client-side. Slow on huge pages
    // (1-2s) but honest about cross-origin assets that html2canvas would taint.
    const fullPng = await domToPng(doc.body, {
      backgroundColor: "#ffffff",
      scale: dpr,
    });

    // Crop the viewport rectangle out of the full capture.
    const img = new Image();
    img.crossOrigin = "anonymous";
    const loaded: Promise<HTMLImageElement> = new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("captured image failed to load"));
    });
    img.src = fullPng;
    await loaded;

    const cropW = Math.min(vw, img.naturalWidth / dpr);
    const cropH = Math.min(vh, img.naturalHeight / dpr);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cropW * dpr);
    canvas.height = Math.round(cropH * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(
      img,
      Math.round(scrollX * dpr),
      Math.round(scrollY * dpr),
      Math.round(cropW * dpr),
      Math.round(cropH * dpr),
      0,
      0,
      Math.round(cropW * dpr),
      Math.round(cropH * dpr),
    );
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("[captureIframeViewport] failed:", e);
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
