import html2canvas from "html2canvas";

/**
 * Capture the live iframe's currently-visible viewport as a base64 PNG.
 * Same-origin only — works because /api/proxy serves at our app origin.
 *
 * Uses html2canvas: it walks the iframe's DOM, reads computed styles, and
 * rasterizes to a canvas. We pass the viewport rectangle directly via x/y/
 * width/height + windowWidth/windowHeight so html2canvas only renders what
 * the user can see — much faster than full-body capture, and avoids many
 * issues with very tall/heavy SPAs.
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
    console.log("[captureIframeViewport] starting html2canvas", {
      scrollX,
      scrollY,
      vw,
      vh,
      bodyChildren: doc.body.children.length,
    });

    const canvas = await html2canvas(doc.body, {
      x: scrollX,
      y: scrollY,
      width: vw,
      height: vh,
      // Allow tainted canvas — better to get a partial screenshot with
      // missing cross-origin images than no screenshot at all.
      allowTaint: true,
      useCORS: true,
      backgroundColor: "#ffffff",
      scale: 1,
      // Skip embedded iframes (chat widgets, ads). They're cross-origin
      // and html2canvas can't read them anyway; trying just adds latency.
      ignoreElements: (el) =>
        el.tagName === "IFRAME" || el.tagName === "SCRIPT",
      logging: false,
      // Use foreignObject rendering when supported — much faster than
      // html2canvas's full DOM walk, less likely to choke on complex CSS.
      foreignObjectRendering: true,
    });
    const dataUrl = canvas.toDataURL("image/png");
    console.log(
      `[captureIframeViewport] html2canvas ok: ${Math.round(dataUrl.length / 1024)}KB`,
    );
    return dataUrl;
  } catch (e) {
    console.error("[captureIframeViewport] html2canvas threw:", e);
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
