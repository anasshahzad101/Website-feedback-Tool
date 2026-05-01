"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ExternalLink, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  parseBridgeMessage,
  postCommand,
  type BridgeReadyPayload,
  type IncomingBridgeMessage,
  type LiveIframeMode,
  type PinAnchor,
  type PinClickPayload,
  type PinPositionsPayload,
  type ProxyErrorPayload,
  type QueryRectsResultPayload,
  type UrlChangedPayload,
} from "@/lib/live-iframe-bridge";

export type PinPosition = PinPositionsPayload["positions"][number];

/** Aggregate position state passed to the render-prop overlay. */
export interface LivePinOverlayState {
  positions: Map<string, PinPosition>;
  scrollX: number;
  scrollY: number;
  viewportW: number;
  viewportH: number;
}

function normalizeWebsiteUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = candidate.startsWith("//")
      ? `https:${candidate}`
      : `https://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

export interface LiveWebsiteViewerProps {
  sourceUrl: string;
  /** Hide the small browser-style toolbar (used when host renders its own controls). */
  hideToolbar?: boolean;
  className?: string;
  /** Min content height — defaults to "max(900px, 100vh)" to match prior behavior. */
  minHeight?: string;
  onLoad?: () => void;
  /**
   * Bridge-controlled interaction mode. When set, the viewer keeps the iframe's
   * bridge in sync — `annotate` makes clicks fire `onPinClick`, `browse` lets
   * them through. When undefined, the iframe stays in its default `browse` state.
   */
  mode?: LiveIframeMode;
  /**
   * Pin anchors pushed into the iframe so it can re-project their viewport
   * positions on scroll/resize/mutation. Pass an empty array to clear.
   */
  pinAnchors?: PinAnchor[];
  /**
   * Render-prop for an absolutely-positioned overlay above the iframe. The
   * overlay covers the iframe exactly, so children can be placed at the same
   * (x, y) the iframe broadcast for each pin position.
   */
  renderOverlay?: (state: LivePinOverlayState) => React.ReactNode;
  /** Fired once the in-iframe bridge has installed and the document is interactive. */
  onBridgeReady?: (payload: BridgeReadyPayload) => void;
  /** Fired when the iframe captures a click while in `annotate` mode. */
  onPinClick?: (payload: PinClickPayload) => void;
  /** Fired when the iframe responds to a `query-rects` command. */
  onQueryRectsResult?: (payload: QueryRectsResultPayload) => void;
  /** Fired when the proxy returns its error page (target unreachable / blocked). */
  onProxyError?: (payload: ProxyErrorPayload) => void;
  /** Fired on every URL change inside the iframe (initial load, pushState, popstate). */
  onUrlChange?: (payload: UrlChangedPayload) => void;
  /** Catch-all for any well-formed bridge message (after the typed callbacks). */
  onBridgeMessage?: (message: IncomingBridgeMessage) => void;
}

/**
 * Renders a remote website inside an iframe via /api/proxy so X-Frame-Options /
 * CSP frame-ancestors do not block embedding. Exposes the underlying iframe
 * element via a forwarded ref so callers can read scroll/viewport state for
 * pin placement.
 */
export const LiveWebsiteViewer = forwardRef<
  HTMLIFrameElement | null,
  LiveWebsiteViewerProps
>(function LiveWebsiteViewer(
  {
    sourceUrl,
    hideToolbar,
    className,
    minHeight,
    onLoad,
    mode,
    pinAnchors,
    renderOverlay,
    onBridgeReady,
    onPinClick,
    onQueryRectsResult,
    onProxyError,
    onUrlChange,
    onBridgeMessage,
  },
  forwardedRef,
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string>("");
  const [reloadKey, setReloadKey] = useState(0);
  // Increments on every `ready` event (initial mount + every internal iframe
  // navigation that reloads the document). All "push state to iframe" effects
  // depend on this counter so they re-fire after navigation.
  const [readyTick, setReadyTick] = useState(0);

  // Callback ref that updates BOTH our internal ref and the forwarded ref on
  // every mount/unmount. useImperativeHandle with `[]` deps was running only
  // once and pointing the parent at a detached element after iframe-key
  // remounts (URL changes, reload), so the parent's iframe ref appeared null
  // when click-to-pin tried to use it.
  const setIframeNode = useCallback(
    (node: HTMLIFrameElement | null) => {
      iframeRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  // Each reload (new src prop) tears down the iframe document. Reset the
  // counter so the next ready fires the effects again.
  useEffect(() => {
    setReadyTick(0);
  }, [iframeSrc]);

  // Push the current mode to the iframe whenever it changes — and again on
  // every ready, so SPA-internal navigations re-sync the mode automatically.
  useEffect(() => {
    if (!mode || readyTick === 0) return;
    postCommand(iframeRef.current, { type: "set-mode", payload: { mode } });
  }, [mode, readyTick]);

  // Push pin anchors into the iframe. Re-fires on every ready so iframe
  // navigation restores anchors without needing a parent prop change.
  useEffect(() => {
    if (readyTick === 0) return;
    postCommand(iframeRef.current, {
      type: "set-pin-anchors",
      payload: { anchors: pinAnchors ?? [] },
    });
  }, [pinAnchors, readyTick]);

  // Latest broadcast from the iframe. Stored as a Map for O(1) overlay lookup.
  const [overlayState, setOverlayState] = useState<LivePinOverlayState>(() => ({
    positions: new Map(),
    scrollX: 0,
    scrollY: 0,
    viewportW: 0,
    viewportH: 0,
  }));
  // Reset overlay state on reload — the new document starts with no positions.
  useEffect(() => {
    setOverlayState({
      positions: new Map(),
      scrollX: 0,
      scrollY: 0,
      viewportW: 0,
      viewportH: 0,
    });
  }, [iframeSrc]);

  // Bridge subscription: callbacks are stored in a ref so a changing handler
  // identity does not tear down the listener on every render.
  const handlersRef = useRef({
    onBridgeReady,
    onPinClick,
    onQueryRectsResult,
    onProxyError,
    onUrlChange,
    onBridgeMessage,
  });
  useEffect(() => {
    handlersRef.current = {
      onBridgeReady,
      onPinClick,
      onQueryRectsResult,
      onProxyError,
      onUrlChange,
      onBridgeMessage,
    };
  }, [
    onBridgeReady,
    onPinClick,
    onQueryRectsResult,
    onProxyError,
    onUrlChange,
    onBridgeMessage,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: MessageEvent) => {
      const msg = parseBridgeMessage(event, iframeRef.current);
      if (!msg) return;
      const h = handlersRef.current;
      switch (msg.type) {
        case "ready":
          // Bump the counter so the mode/anchors useEffects re-fire and
          // re-sync state after iframe internal navigations.
          setReadyTick((n) => n + 1);
          h.onBridgeReady?.(msg.payload);
          break;
        case "pin-click":
          h.onPinClick?.(msg.payload);
          break;
        case "query-rects-result":
          h.onQueryRectsResult?.(msg.payload);
          break;
        case "pin-positions": {
          const map = new Map<string, PinPosition>();
          for (const p of msg.payload.positions) map.set(p.id, p);
          setOverlayState({
            positions: map,
            scrollX: msg.payload.scrollX,
            scrollY: msg.payload.scrollY,
            viewportW: msg.payload.viewportW,
            viewportH: msg.payload.viewportH,
          });
          break;
        }
        case "proxy-error":
          h.onProxyError?.(msg.payload);
          break;
        case "url-changed":
          h.onUrlChange?.(msg.payload);
          break;
      }
      h.onBridgeMessage?.(msg);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    setIframeLoaded(false);
    if (typeof window === "undefined") {
      setIframeSrc("");
      return;
    }
    const normalized = normalizeWebsiteUrl(sourceUrl);
    if (!normalized) {
      setIframeSrc("");
      return;
    }
    setIframeSrc(
      `${window.location.origin}/api/proxy?url=${encodeURIComponent(normalized)}`,
    );
  }, [sourceUrl, reloadKey]);

  // Defensive: if onLoad never fires (heavy SPA, network stall) clear the loader after 10s.
  useEffect(() => {
    if (!iframeSrc) return;
    const t = setTimeout(() => setIframeLoaded(true), 10000);
    return () => clearTimeout(t);
  }, [iframeSrc]);

  const handleLoad = useCallback(() => {
    setIframeLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleReload = useCallback(() => {
    setReloadKey((n) => n + 1);
  }, []);

  const effectiveMinHeight = minHeight ?? "max(900px, 100vh)";

  return (
    <div className={cn("relative flex w-full flex-col bg-white", className)}>
      {!hideToolbar && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleReload}
            title="Reload preview"
            aria-label="Reload preview"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <div
            className="flex-1 truncate rounded border bg-background px-2 py-1 font-mono text-xs text-muted-foreground"
            title={sourceUrl}
          >
            {sourceUrl}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            asChild
            title="Open original in new tab"
            aria-label="Open original in new tab"
          >
            <a
              href={normalizeWebsiteUrl(sourceUrl) ?? sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      )}

      <div
        className="relative w-full"
        style={{ minHeight: effectiveMinHeight, height: effectiveMinHeight }}
      >
        {!iframeLoaded && iframeSrc && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm font-medium">Loading preview…</span>
            </div>
          </div>
        )}

        {iframeSrc ? (
          <>
            <iframe
              key={`${iframeSrc}#${reloadKey}`}
              ref={setIframeNode}
              src={iframeSrc}
              title={sourceUrl}
              className="relative z-0 block h-full w-full border-0"
              style={{ pointerEvents: "auto" }}
              onLoad={handleLoad}
              onError={handleLoad}
            />
            {renderOverlay && (
              // Pin overlay sits exactly on top of the iframe. Its container
              // is pointer-events:none so the iframe stays interactive; the
              // overlay's own children opt in by setting pointer-events on
              // themselves. Overflow is hidden so pins scrolled past the
              // iframe edges get clipped instead of leaking into the page.
              <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
                {renderOverlay(overlayState)}
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/30">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm font-medium">Preparing preview…</span>
              <span
                className="max-w-xs truncate text-center text-xs"
                title={sourceUrl}
              >
                {sourceUrl}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
