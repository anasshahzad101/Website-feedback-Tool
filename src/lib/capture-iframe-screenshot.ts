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
  if (typeof window === "undefined") return null;
  if (!iframe) return null;
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc || !doc.body) return null;
  try {
    const scrollX = win.scrollX || 0;
    const scrollY = win.scrollY || 0;
    const vw = win.innerWidth;
    const vh = win.innerHeight;
    if (vw <= 0 || vh <= 0) return null;
    const docW =
      doc.documentElement.scrollWidth || doc.body.scrollWidth || vw;
    const docH =
      doc.documentElement.scrollHeight || doc.body.scrollHeight || vh;

    const canvas = await html2canvas(doc.body, {
      x: scrollX,
      y: scrollY,
      width: vw,
      height: vh,
      windowWidth: docW,
      windowHeight: docH,
      // Allow tainted canvas — better to get a partial screenshot with
      // missing cross-origin images than no screenshot at all.
      allowTaint: true,
      useCORS: true,
      backgroundColor: "#ffffff",
      scale: 1,
      // Skip embedded iframes (chat widgets, ads). They're cross-origin
      // and html2canvas can't read them anyway; trying just adds latency.
      ignoreElements: (el) => el.tagName === "IFRAME",
      logging: false,
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[captureIframeViewport] html2canvas failed:", e);
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
