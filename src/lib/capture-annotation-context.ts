"use client";

import { domToPng } from "modern-screenshot";
import html2canvas from "html2canvas";

const MAX_CONTEXT_EDGE = 1600;

type ViewportTarget =
  | {
      kind: "root";
      el: HTMLElement;
      scrollLeft: number;
      scrollTop: number;
      viewW: number;
      viewH: number;
    }
  | {
      kind: "element";
      el: HTMLElement;
      scrollLeft: number;
      scrollTop: number;
      viewW: number;
      viewH: number;
    };

function resolveViewportTarget(
  doc: Document,
  win: Window,
  iframe: HTMLIFrameElement
): ViewportTarget {
  const se = (doc.scrollingElement ?? doc.documentElement) as HTMLElement;
  const viewW = Math.max(1, Math.round(win.innerWidth || iframe.clientWidth));
  const viewH = Math.max(1, Math.round(win.innerHeight || iframe.clientHeight));

  const rootSL = se.scrollLeft;
  const rootST = se.scrollTop;
  const rootScrolls = rootST > 0 || rootSL > 0;

  if (rootScrolls) {
    return {
      kind: "root",
      el: se,
      scrollLeft: rootSL,
      scrollTop: rootST,
      viewW,
      viewH,
    };
  }

  try {
    const cx = Math.floor(viewW / 2);
    const cy = Math.floor(viewH / 2);
    let node: Element | null = doc.elementFromPoint(cx, cy);
    let scrolledInner: HTMLElement | null = null;
    let scrollableInner: HTMLElement | null = null;

    while (node && node !== doc.documentElement) {
      const el = node as HTMLElement;
      const style = win.getComputedStyle(el);
      const oy = style.overflowY;
      const ox = style.overflowX;
      const scrollableY =
        (oy === "auto" || oy === "scroll" || oy === "overlay") &&
        el.scrollHeight > el.clientHeight + 1;
      const scrollableX =
        (ox === "auto" || ox === "scroll" || ox === "overlay") &&
        el.scrollWidth > el.clientWidth + 1;

      if (scrollableY || scrollableX) {
        if (!scrollableInner) scrollableInner = el;
        if (el.scrollTop > 0 || el.scrollLeft > 0) {
          scrolledInner = el;
          break;
        }
      }
      node = el.parentElement;
    }

    const pick = scrolledInner ?? scrollableInner;
    if (pick) {
      return {
        kind: "element",
        el: pick,
        scrollLeft: pick.scrollLeft,
        scrollTop: pick.scrollTop,
        viewW: pick.clientWidth,
        viewH: pick.clientHeight,
      };
    }
  } catch {
    /* ignore */
  }

  return {
    kind: "root",
    el: se,
    scrollLeft: rootSL,
    scrollTop: rootST,
    viewW,
    viewH,
  };
}

export type ViewportPinFocus = { x: number; y: number };

/** Snapshot from `freezeIframeViewport` — pass into `captureIframeViewport` so async capture matches submit-time scroll. */
export type FrozenIframeViewport = ViewportTarget;

export type CaptureIframeViewportOptions = {
  /** Avoid very heavy html2canvas fallback on large/complex pages. */
  allowHeavyFallback?: boolean;
  /** Prefer viewport-accurate crop path over faster clone-based capture. */
  preferAccuracy?: boolean;
  /** Use scroll/viewport from submit time instead of reading live scroll when capture runs later. */
  frozen?: FrozenIframeViewport | null;
};

/**
 * Call synchronously before any `await` on comment submit so later async capture
 * still crops to the viewport the user had when they clicked send.
 */
export function freezeIframeViewport(
  iframe: HTMLIFrameElement
): FrozenIframeViewport | null {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc?.body || !win) return null;
  try {
    return resolveViewportTarget(doc, win, iframe);
  } catch {
    return null;
  }
}

function viewportForCapture(
  doc: Document,
  win: Window,
  iframe: HTMLIFrameElement,
  frozen: FrozenIframeViewport | null | undefined
): ViewportTarget {
  if (
    frozen?.el &&
    frozen.el.isConnected &&
    frozen.el.ownerDocument === doc
  ) {
    return frozen;
  }
  return resolveViewportTarget(doc, win, iframe);
}

/** Tighter crop around the pin (CSS px in the iframe / annotation layer). */
async function focusCropAroundPin(
  dataUrl: string,
  pinX: number,
  pinY: number,
  viewWCss: number,
  viewHCss: number,
  focusFraction = 0.72
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw || !ih) {
        resolve(dataUrl);
        return;
      }
      const sx = iw / Math.max(1, viewWCss);
      const sy = ih / Math.max(1, viewHCss);
      const cx = pinX * sx;
      const cy = pinY * sy;
      const targetW = Math.min(iw, iw * focusFraction);
      const targetH = Math.min(ih, ih * focusFraction);
      let x0 = Math.round(cx - targetW / 2);
      let y0 = Math.round(cy - targetH / 2);
      x0 = Math.max(0, Math.min(x0, iw - targetW));
      y0 = Math.max(0, Math.min(y0, ih - targetH));

      const c = document.createElement("canvas");
      c.width = Math.min(Math.round(targetW), MAX_CONTEXT_EDGE);
      c.height = Math.min(Math.round(targetH), MAX_CONTEXT_EDGE);
      const ctx = c.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, x0, y0, targetW, targetH, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png", 0.88));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function downscaleDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w <= MAX_CONTEXT_EDGE && h <= MAX_CONTEXT_EDGE) {
        resolve(dataUrl);
        return;
      }
      const r = Math.min(MAX_CONTEXT_EDGE / w, MAX_CONTEXT_EDGE / h, 1);
      w = Math.max(1, Math.floor(w * r));
      h = Math.max(1, Math.floor(h * r));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/png", 0.88));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * modern-screenshot clones the DOM and can re-apply scroll offsets on children (restoreScrollPosition).
 * width/height limit output to the visible viewport size.
 */
async function captureWithModernScreenshot(
  doc: Document,
  vt: ViewportTarget
): Promise<string | null> {
  const node = vt.el;
  if (!node || (node === doc.documentElement && !doc.body)) return null;

  const dpr = Math.min(2, doc.defaultView?.devicePixelRatio ?? 1);

  try {
    const dataUrl = await domToPng(node, {
      width: vt.viewW,
      height: vt.viewH,
      scale: dpr,
      backgroundColor: "#ffffff",
      timeout: 30000,
      features: {
        restoreScrollPosition: true,
      },
    });
    if (!dataUrl || !dataUrl.startsWith("data:")) return null;
    return dataUrl;
  } catch {
    return null;
  }
}

/** Legacy path if modern-screenshot fails on a given page. */
async function renderFullAndCropViewport(
  target: HTMLElement,
  scrollLeft: number,
  scrollTop: number,
  viewportW: number,
  viewportH: number
): Promise<string | null> {
  const canvas = await html2canvas(target, {
    allowTaint: true,
    useCORS: true,
    logging: false,
    foreignObjectRendering: false,
    scale: 1,
    backgroundColor: "#ffffff",
  });

  const docW = Math.max(target.scrollWidth, target.clientWidth, 1);
  const docH = Math.max(target.scrollHeight, target.clientHeight, 1);

  const scaleX = canvas.width / docW;
  const scaleY = canvas.height / docH;

  let sx = Math.floor(scrollLeft * scaleX);
  let sy = Math.floor(scrollTop * scaleY);
  let sw = Math.ceil(viewportW * scaleX);
  let sh = Math.ceil(viewportH * scaleY);

  sx = Math.max(0, Math.min(sx, Math.max(0, canvas.width - 1)));
  sy = Math.max(0, Math.min(sy, Math.max(0, canvas.height - 1)));
  sw = Math.max(1, Math.min(sw, canvas.width - sx));
  sh = Math.max(1, Math.min(sh, canvas.height - sy));

  const outW = Math.min(sw, MAX_CONTEXT_EDGE);
  const outH = Math.min(sh, MAX_CONTEXT_EDGE);
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, outW, outH);
  return out.toDataURL("image/png", 0.88);
}

export async function captureIframeViewport(
  iframe: HTMLIFrameElement,
  pin?: ViewportPinFocus,
  options?: CaptureIframeViewportOptions
): Promise<string | null> {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc?.body || !win) return null;

  try {
    const vt = viewportForCapture(doc, win, iframe, options?.frozen);

    let dataUrl: string | null = null;
    const canHeavy = options?.allowHeavyFallback === true;
    const preferAccuracy = options?.preferAccuracy === true;

    if (preferAccuracy && canHeavy) {
      // Accuracy path first: captures from the current scroll position.
      dataUrl = await renderFullAndCropViewport(
        vt.el,
        vt.scrollLeft,
        vt.scrollTop,
        vt.viewW,
        vt.viewH
      );
      // If this fails, still try the faster clone-based path.
      if (!dataUrl) {
        dataUrl = await captureWithModernScreenshot(doc, vt);
      }
    } else {
      // Default path: fast first, heavy fallback optional.
      dataUrl = await captureWithModernScreenshot(doc, vt);
      if (!dataUrl && canHeavy) {
        dataUrl = await renderFullAndCropViewport(
          vt.el,
          vt.scrollLeft,
          vt.scrollTop,
          vt.viewW,
          vt.viewH
        );
      }
    }
    if (!dataUrl) return null;

    if (pin) {
      dataUrl = await focusCropAroundPin(
        dataUrl,
        pin.x,
        pin.y,
        vt.viewW,
        vt.viewH
      );
    }

    return await downscaleDataUrl(dataUrl);
  } catch (e) {
    console.warn("captureIframeViewport failed", e);
    return null;
  }
}

export function captureImageAroundPin(
  img: HTMLImageElement,
  xPercent: number,
  yPercent: number
): string | null {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return null;

  const cx = xPercent * nw;
  const cy = yPercent * nh;
  const cropW = Math.min(nw, Math.round(nw * 0.5));
  const cropH = Math.min(nh, Math.round(cropW * 0.62));
  let sx = Math.round(cx - cropW / 2);
  let sy = Math.round(cy - cropH / 2);
  sx = Math.max(0, Math.min(sx, nw - cropW));
  sy = Math.max(0, Math.min(sy, nh - cropH));

  try {
    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
    return canvas.toDataURL("image/png", 0.88);
  } catch {
    return null;
  }
}
