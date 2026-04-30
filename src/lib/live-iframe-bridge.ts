/**
 * Cross-frame protocol between the parent app and a proxied page iframe.
 *
 * The iframe is same-origin (loads `<appOrigin>/api/proxy?...`) so postMessage
 * is reliable and origin-checkable. All bridge messages are wrapped in an
 * envelope `{ __wft: 1, v: 1, type, payload }` so we don't conflict with
 * unrelated postMessage traffic from third-party scripts on the proxied page.
 */

export const BRIDGE_MARKER = "__wft" as const;
export const BRIDGE_VERSION = 1 as const;

export type LiveIframeMode = "annotate" | "browse";

/** Iframe → parent: bridge has installed and document is interactive. */
export interface BridgeReadyPayload {
  href: string;
}

/** Iframe → parent: a click was captured in annotate mode. */
export interface PinClickPayload {
  selector: string | null;
  offsetXPct: number;
  offsetYPct: number;
  viewportW: number;
  viewportH: number;
  scrollX: number;
  scrollY: number;
  docX: number;
  docY: number;
}

/** Iframe → parent: response to a `query-rects` command. */
export interface QueryRectsResultPayload {
  id: string;
  rects: Array<{
    selector: string;
    rect: { x: number; y: number; width: number; height: number } | null;
  }>;
  scrollX: number;
  scrollY: number;
  viewportW: number;
  viewportH: number;
}

/** Anchor metadata describing where a pin lives on a live page. */
export interface PinAnchor {
  /** Stable identifier — usually the annotation id. */
  id: string;
  /** Best-effort CSS path captured when the pin was created. May be null. */
  selector: string | null;
  /** 0..1 offset within the matched element's bounding rect. */
  offsetXPct: number;
  offsetYPct: number;
  /** Document-level coordinates captured when the pin was created (fallback). */
  docX: number;
  docY: number;
}

/**
 * Iframe → parent: the proxy could not load the target URL. The iframe is
 * showing the proxy's error HTML; the parent should consider falling back to
 * a snapshot or showing an error UI.
 */
export interface ProxyErrorPayload {
  status: number;
  url: string;
  message: string;
}

/** Iframe → parent: re-projected screen positions for known pin anchors. */
export interface PinPositionsPayload {
  positions: Array<{
    id: string;
    /** Viewport-relative x,y inside the iframe, in CSS px. */
    x: number;
    y: number;
    /** True if the pin is within the current iframe viewport. */
    visible: boolean;
    /** True if the selector resolved (false → fell back to doc coords). */
    anchored: boolean;
  }>;
  scrollX: number;
  scrollY: number;
  viewportW: number;
  viewportH: number;
}

export type IncomingBridgeMessage =
  | { type: "ready"; payload: BridgeReadyPayload }
  | { type: "pin-click"; payload: PinClickPayload }
  | { type: "query-rects-result"; payload: QueryRectsResultPayload }
  | { type: "pin-positions"; payload: PinPositionsPayload }
  | { type: "proxy-error"; payload: ProxyErrorPayload };

/** Parent → iframe commands. */
export type OutgoingBridgeCommand =
  | { type: "set-mode"; payload: { mode: LiveIframeMode } }
  | { type: "scroll-to-doc"; payload: { x: number; y: number; smooth?: boolean } }
  | {
      type: "scroll-to-selector";
      payload: {
        selector: string;
        smooth?: boolean;
        block?: "start" | "center" | "end" | "nearest";
      };
    }
  | {
      type: "query-rects";
      payload: { id: string; selectors: string[] };
    }
  | {
      type: "set-pin-anchors";
      payload: { anchors: PinAnchor[] };
    };

interface BridgeEnvelope {
  __wft: typeof BRIDGE_VERSION;
  v: typeof BRIDGE_VERSION;
  type: string;
  payload: unknown;
}

function isBridgeEnvelope(data: unknown): data is BridgeEnvelope {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return d[BRIDGE_MARKER] === BRIDGE_VERSION && typeof d.type === "string";
}

/** Send a structured command to the iframe's content window. */
export function postCommand(
  iframe: HTMLIFrameElement | null,
  command: OutgoingBridgeCommand,
): boolean {
  const win = iframe?.contentWindow;
  if (!win) return false;
  try {
    const targetOrigin =
      typeof window !== "undefined" ? window.location.origin : "*";
    win.postMessage(
      {
        [BRIDGE_MARKER]: BRIDGE_VERSION,
        v: BRIDGE_VERSION,
        type: command.type,
        payload: command.payload,
      },
      targetOrigin,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Stored anchor metadata for a saved annotation (deserialized from
 * `Annotation.viewportMetaJson`). Returns null if the JSON is missing,
 * malformed, or not a live-dom anchor.
 */
export function parseLiveAnchorMeta(
  viewportMetaJson: string | null | undefined,
): Omit<PinAnchor, "id"> | null {
  if (!viewportMetaJson) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(viewportMetaJson);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.anchor !== "live-dom") return null;
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    selector: typeof o.selector === "string" ? o.selector : null,
    offsetXPct: num(o.offsetXPct, 0),
    offsetYPct: num(o.offsetYPct, 0),
    docX: num(o.docX, 0),
    docY: num(o.docY, 0),
  };
}

/**
 * Parse a `MessageEvent` into a typed bridge message if it came from the
 * given iframe and is a valid envelope. Returns `null` for unrelated messages.
 */
export function parseBridgeMessage(
  event: MessageEvent,
  iframe: HTMLIFrameElement | null,
): IncomingBridgeMessage | null {
  if (!iframe?.contentWindow || event.source !== iframe.contentWindow) {
    return null;
  }
  if (
    typeof window !== "undefined" &&
    event.origin !== window.location.origin
  ) {
    return null;
  }
  const data = event.data;
  if (!isBridgeEnvelope(data)) return null;
  switch (data.type) {
    case "ready":
      return { type: "ready", payload: (data.payload as BridgeReadyPayload) ?? { href: "" } };
    case "pin-click":
      return { type: "pin-click", payload: data.payload as PinClickPayload };
    case "query-rects-result":
      return {
        type: "query-rects-result",
        payload: data.payload as QueryRectsResultPayload,
      };
    case "pin-positions":
      return {
        type: "pin-positions",
        payload: data.payload as PinPositionsPayload,
      };
    case "proxy-error":
      return {
        type: "proxy-error",
        payload: data.payload as ProxyErrorPayload,
      };
    default:
      return null;
  }
}
