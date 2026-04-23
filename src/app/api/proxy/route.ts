import { NextRequest, NextResponse } from "next/server";
import { publicRequestOrigin } from "@/lib/server/public-request-origin";

// Headers that prevent iframe embedding or break proxied body — we strip these when proxying
const BLOCKED_RESPONSE_HEADERS = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  // Node fetch decompresses responses; we send decompressed body so browser must not see these
  "content-encoding",
  "transfer-encoding",
]);

const NO_STORE_PREVIEW_HEADERS: Record<string, string> = {
  "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  pragma: "no-cache",
  expires: "0",
};

// Headers we should not forward from the original request
const BLOCKED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "keep-alive",
  "proxy-connection",
  "proxy-authenticate",
  "proxy-authorization",
]);

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  const url = rawUrl
    ?.replace(/&amp;/gi, "&")
    .replace(/^['"]|['"]$/g, "")
    .trim();
  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return new NextResponse("Only http/https URLs are supported", { status: 400 });
  }

  try {
    // Request uncompressed response to avoid encoding mismatch (we strip content-encoding anyway)
    const forwardHeaders: Record<string, string> = {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "accept-encoding": "identity",
      accept:
        req.headers.get("accept") ||
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": req.headers.get("accept-language") || "en-US,en;q=0.9",
    };

    let response = await fetch(url, {
      headers: forwardHeaders,
      redirect: "follow",
      // 20 second timeout
      signal: AbortSignal.timeout(20000),
    });

    // If the target URL returns a 404, try falling back to the origin root once.
    // This matches the behavior where clicking "Return home" on many marketing sites
    // navigates back to a working homepage.
    if (response.status === 404 && targetUrl.pathname !== "/") {
      const rootUrl = `${targetUrl.origin}/`;
      try {
        const rootResponse = await fetch(rootUrl, {
          headers: forwardHeaders,
          redirect: "follow",
          signal: AbortSignal.timeout(20000),
        });
        // Only replace the response if the root actually works
        if (rootResponse.ok) {
          response = rootResponse;
        }
      } catch {
        // Ignore fallback errors; we'll still return the original 404 response below
      }
    }

    const contentType = response.headers.get("content-type") || "text/html";
    const isHtml = contentType.includes("text/html");
    const isCss = contentType.includes("text/css");

    // Build safe response headers (strip frame-blocking headers)
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!BLOCKED_RESPONSE_HEADERS.has(lowerKey) && !BLOCKED_REQUEST_HEADERS.has(lowerKey)) {
        responseHeaders.set(key, value);
      }
    });

    // Do not set x-frame-options so the proxied page can be embedded in our iframe.
    // (We already stripped the target's x-frame-options above.)

    const appOrigin = publicRequestOrigin(req);

    if (isHtml) {
      let html = await response.text();

      // Drop meta CSP / frame policies that still block rendering inside our iframe
      html = html.replace(
        /<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi,
        ""
      );

      // Inject <base> tag so relative URLs resolve against the proxied origin
      const baseTag = `<base href="${targetUrl.origin}${targetUrl.pathname.substring(0, targetUrl.pathname.lastIndexOf("/") + 1)}" target="_self">`;

      // SPAs (e.g. Canva) use fetch('/api/...'), XHR, and webpack chunk paths that resolve against
      // the iframe document URL (our app host), not <base>. That yields 404s on /api/_assets, etc.
      // Run this synchronously first in <head> so it wins over bundled loaders.
      const runtimePatch = buildSameDocumentRuntimePatch(targetUrl.origin, appOrigin);

      // Rewrite absolute URLs of common resources to go through our proxy
      // Also inject base tag right after <head>
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/(<head[^>]*>)/i, `$1${baseTag}${runtimePatch}`);
      } else {
        html = baseTag + runtimePatch + html;
      }

      // Subresources → same-origin proxy URLs so canvas capture (html2canvas/modern-screenshot)
      // can read pixels without cross-origin taint, and path-relative URLs like `w=1688/...`
      // do not resolve against `/api/proxy` on the app host.
      html = rewriteSubresourceRootRelativeUrls(html, targetUrl, appOrigin);
      html = rewritePathRelativeCdnPatterns(html, targetUrl, appOrigin);
      html = rewriteSameSiteAbsoluteSubresourceUrlsToProxy(html, targetUrl, appOrigin);
      // Navigational href/action → full appOrigin + /api/proxy so clicks stay same-origin
      // (otherwise <base> + absolute target links navigate the iframe cross-origin and pin capture breaks).
      html = rewriteNavigationalRootRelativeToProxy(html, targetUrl, appOrigin);
      html = rewriteSameSiteAbsoluteNavUrlsToProxy(html, targetUrl, appOrigin);

      responseHeaders.set("content-type", "text/html; charset=utf-8");
      for (const [k, v] of Object.entries(NO_STORE_PREVIEW_HEADERS)) {
        responseHeaders.set(k, v);
      }
      return new NextResponse(html, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    if (isCss) {
      const css = await response.text();
      const rewrittenCss = rewriteCssUrls(css, targetUrl, appOrigin);
      responseHeaders.set("content-type", "text/css; charset=utf-8");
      for (const [k, v] of Object.entries(NO_STORE_PREVIEW_HEADERS)) {
        responseHeaders.set(k, v);
      }
      return new NextResponse(rewrittenCss, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // For non-HTML content (CSS, images, etc.) just pass through
    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error for URL:", url, error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem;color:#555">
        <h3>Could not load website</h3>
        <p>The website at <strong>${url}</strong> could not be proxied.</p>
        <p style="color:#999;font-size:0.85rem">Error: ${message}</p>
        <p><a href="${url}" target="_blank" rel="noopener noreferrer">Open in new tab instead →</a></p>
      </body></html>`,
      {
        status: 502,
        headers: { "content-type": "text/html; charset=utf-8" },
      }
    );
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function proxyAssetUrl(appOrigin: string, absoluteUrl: string): string {
  return `${appOrigin}/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
}

const LINK_SUBRESOURCE_REL =
  /\brel\s*=\s*["'][^"']*\b(?:stylesheet|preload|modulepreload)\b/i;

function shouldProxyAbsoluteSubresourceUrl(
  raw: string,
  siteUrl: URL,
  appOrigin: string
): string | null {
  const t = raw.trim();
  if (!t || t.startsWith("data:") || t.startsWith("#")) return null;
  let appHost: string;
  try {
    appHost = new URL(appOrigin).host;
  } catch {
    appHost = "";
  }
  try {
    const u = new URL(t, siteUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (appHost && u.host === appHost) return null;
    const abs = u.toString();
    if (abs.includes(`${appOrigin}/api/proxy`)) return null;
    return proxyAssetUrl(appOrigin, abs);
  } catch {
    return null;
  }
}

/**
 * Rewrite <link rel="stylesheet|preload|modulepreload" href="..."> so styles load same-origin
 * for capture (modern-screenshot / html2canvas cssRules). Invoked once per URL phase.
 */
function rewriteLinkTagHrefsPhase(
  html: string,
  phase: "root-relative" | "path-relative" | "absolute",
  documentUrl: URL,
  appOrigin: string,
  siteUrl: URL
): string {
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!LINK_SUBRESOURCE_REL.test(tag)) return tag;
    const hm = tag.match(/\bhref\s*=\s*(["'])([^"']+)\1/i);
    if (!hm) return tag;
    const q = hm[1];
    const val = hm[2];
    const trimmed = val.trim();
    let next: string | null = null;

    if (phase === "root-relative") {
      if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
        try {
          next = proxyAssetUrl(appOrigin, `${documentUrl.origin}${trimmed}`);
        } catch {
          next = null;
        }
      }
    } else if (phase === "path-relative") {
      if (
        trimmed &&
        !/^(https?:|\/\/|data:|#|\/)/i.test(trimmed) &&
        /^(w=\d+\/|cdn-cgi\/)/i.test(trimmed)
      ) {
        try {
          next = proxyAssetUrl(
            appOrigin,
            new URL(trimmed, documentUrl).toString()
          );
        } catch {
          next = null;
        }
      }
    } else {
      next = shouldProxyAbsoluteSubresourceUrl(trimmed, siteUrl, appOrigin);
    }

    if (next == null || next === val) return tag;
    let out = tag.replace(hm[0], `href=${q}${next}${q}`);
    if (
      /\brel\s*=\s*["'][^"']*stylesheet/i.test(out) &&
      !/\bcrossorigin\s*=/i.test(out)
    ) {
      if (out.endsWith("/>")) {
        out = `${out.slice(0, -2)} crossorigin="anonymous" />`;
      } else if (out.endsWith(">")) {
        out = `${out.slice(0, -1)} crossorigin="anonymous">`;
      }
    }
    return out;
  });
}

/**
 * Inline script inserted at the start of proxied HTML: many SPAs resolve `/api/...`, XHR, and script
 * URLs against the iframe document (our app origin), ignoring `<base>`. Rewrites those at runtime.
 */
function buildSameDocumentRuntimePatch(targetOrigin: string, appOrigin: string): string {
  const T = JSON.stringify(targetOrigin);
  const A = JSON.stringify(appOrigin);
  const js = `(function(){
  var T=${T},A=${A},PH=A+"/api/proxy?url=";
  function P(u){return PH+encodeURIComponent(u);}
  function R(u){
    if(u==null||typeof u!=="string")return u;
    if(u.startsWith(A+"/api/proxy"))return u;
    if(u.charAt(0)==="/"&&u.charAt(1)!=="/")return P(T+u);
    try{
      var bo=new URL(A).origin;
      var p=new URL(u,A+"/");
      if(p.origin===bo&&p.pathname.startsWith("/api/")&&!p.pathname.startsWith("/api/proxy"))return P(T+p.pathname+p.search+p.hash);
    }catch(e){}
    return u;
  }
  var fe=window.fetch;
  window.fetch=function(i,n){
    if(typeof i==="string")return fe.call(this,R(i),n);
    if(typeof Request!=="undefined"&&i instanceof Request){var ru=R(i.url);if(ru!==i.url)return fe.call(this,new Request(ru,i),n);}
    return fe.call(this,i,n);
  };
  var xo=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(){var a=[].slice.call(arguments);if(typeof a[1]==="string")a[1]=R(a[1]);return xo.apply(this,a);};
  var sa=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(k,v){
    var t=this.tagName,lk=(k+"").toLowerCase();
    if((t==="SCRIPT"&&lk==="src")||(t==="LINK"&&lk==="href")||(t==="IMG"&&lk==="src")||(t==="SOURCE"&&lk==="src"))v=R(String(v));
    return sa.call(this,k,v);
  };
  function patchSrcLike(ctor,prop){
    try{var d=Object.getOwnPropertyDescriptor(ctor.prototype,prop);
    if(!d||!d.set)return;
    Object.defineProperty(ctor.prototype,prop,{get:d.get,set:function(v){d.set.call(this,R(String(v)));},configurable:true});
    }catch(e){}
  }
  if(typeof HTMLScriptElement!=="undefined")patchSrcLike(HTMLScriptElement,"src");
  if(typeof HTMLLinkElement!=="undefined")patchSrcLike(HTMLLinkElement,"href");
  if(typeof HTMLImageElement!=="undefined")patchSrcLike(HTMLImageElement,"src");
  if(typeof HTMLSourceElement!=="undefined")patchSrcLike(HTMLSourceElement,"src");
  if(navigator.sendBeacon){var sb=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(u,d){return sb(typeof u==="string"?R(u):u,d);};}
})();`;
  return `<script>${js}</script>`;
}

/** Root-relative subresource URLs (src / srcset) → same-origin proxy of the target absolute URL. */
function rewriteSubresourceRootRelativeUrls(
  html: string,
  baseUrl: URL,
  appOrigin: string
): string {
  html = html.replace(
    /((?:src)=["'])(\/(?!\/)[^"']*)(["'])/gi,
    (match, prefix, rootRelativePath, suffix) => {
      try {
        const absUrl = `${baseUrl.origin}${rootRelativePath}`;
        return `${prefix}${proxyAssetUrl(appOrigin, absUrl)}${suffix}`;
      } catch {
        return match;
      }
    }
  );

  html = html.replace(/(srcset=["'])([^"']+)(["'])/gi, (match, prefix, value, suffix) => {
    const rewritten = String(value)
      .split(",")
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) return trimmed;
        const bits = trimmed.split(/\s+/);
        const candidate = bits[0] ?? "";
        if (!candidate.startsWith("/") || candidate.startsWith("//")) return trimmed;
        const absUrl = `${baseUrl.origin}${candidate}`;
        return [proxyAssetUrl(appOrigin, absUrl), ...bits.slice(1)].join(" ");
      })
      .join(", ");
    return `${prefix}${rewritten}${suffix}`;
  });

  html = rewriteLinkTagHrefsPhase(
    html,
    "root-relative",
    baseUrl,
    appOrigin,
    baseUrl
  );

  return html;
}

/**
 * Path-relative URLs that commonly appear on Cloudflare / WordPress pages (e.g. `w=1688/...`)
 * resolve incorrectly when the iframe document is `/api/proxy?...` (they become `/api/w=...` on
 * the app host). Rewrite to a proxy URL against the reviewed page's origin.
 */
function rewritePathRelativeCdnPatterns(
  html: string,
  documentUrl: URL,
  appOrigin: string
): string {
  const rewriteAttr = (
    attr: string,
    value: string
  ): string | null => {
    const t = value.trim();
    if (!t || /^(https?:|\/\/|data:|#|\/)/i.test(t)) return null;
    if (!/^(w=\d+\/|cdn-cgi\/)/i.test(t)) return null;
    try {
      const abs = new URL(t, documentUrl).toString();
      return proxyAssetUrl(appOrigin, abs);
    } catch {
      return null;
    }
  };

  html = html.replace(
    new RegExp(`\\b(src|href|poster)=(["'])([^"']+)\\2`, "gi"),
    (match, attr: string, q: string, val: string) => {
      const next = rewriteAttr(attr, val);
      return next ? `${attr}=${q}${next}${q}` : match;
    }
  );

  html = html.replace(/(srcset=["'])([^"']+)(["'])/gi, (match, prefix, value, suffix) => {
    const rewritten = String(value)
      .split(",")
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) return trimmed;
        const bits = trimmed.split(/\s+/);
        const candidate = bits[0] ?? "";
        const proxied = rewriteAttr("src", candidate);
        return proxied ? [proxied, ...bits.slice(1)].join(" ") : trimmed;
      })
      .join(", ");
    return `${prefix}${rewritten}${suffix}`;
  });

  html = rewriteLinkTagHrefsPhase(
    html,
    "path-relative",
    documentUrl,
    appOrigin,
    documentUrl
  );

  return html;
}

/**
 * Absolute http(s) subresource URLs → same-origin proxy (any off-app origin).
 * Reviewed pages often load fonts/images from CDNs (e.g. cdn.*) that block cross-origin canvas reads;
 * routing them through /api/proxy keeps capture libraries from hitting CORS taint.
 */
function rewriteSameSiteAbsoluteSubresourceUrlsToProxy(
  html: string,
  siteUrl: URL,
  appOrigin: string
): string {
  let appHost: string;
  try {
    appHost = new URL(appOrigin).host;
  } catch {
    appHost = "";
  }
  const shouldProxy = (u: URL): boolean => {
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (appHost && u.host === appHost) return false;
    return true;
  };

  const rewriteValue = (raw: string): string => {
    const t = raw.trim();
    if (!t || t.startsWith("data:") || t.startsWith("#")) return raw;
    try {
      const u = new URL(t, siteUrl);
      if (!shouldProxy(u)) return raw;
      const abs = u.toString();
      if (abs.includes(`${appOrigin}/api/proxy`)) return raw;
      return proxyAssetUrl(appOrigin, abs);
    } catch {
      return raw;
    }
  };

  html = html.replace(
    /\b(src|srcset|poster)=(["'])([^"']+)\2/gi,
    (match, attr: string, q: string, value: string) => {
      if (attr.toLowerCase() === "srcset") {
        const rewritten = value
          .split(",")
          .map((part) => {
            const trimmed = part.trim();
            if (!trimmed) return trimmed;
            const bits = trimmed.split(/\s+/);
            const first = bits[0] ?? "";
            const rest = [rewriteValue(first), ...bits.slice(1)].join(" ");
            return rest;
          })
          .join(", ");
        return `${attr}=${q}${rewritten}${q}`;
      }
      return `${attr}=${q}${rewriteValue(value)}${q}`;
    }
  );

  html = rewriteLinkTagHrefsPhase(
    html,
    "absolute",
    siteUrl,
    appOrigin,
    siteUrl
  );

  return html;
}

function hostVariants(host: string): string[] {
  const out = new Set<string>([host]);
  if (host.startsWith("www.")) {
    out.add(host.slice(4));
  } else {
    out.add(`www.${host}`);
  }
  return [...out];
}

/** href / action / formaction with root-relative path → stay in iframe via proxy (full app URL). */
function rewriteNavigationalRootRelativeToProxy(
  html: string,
  siteUrl: URL,
  appOrigin: string
): string {
  // Exclude <link> (stylesheets, etc.) — those are subresources, not navigation.
  return html.replace(
    /<((?!link\b)[a-zA-Z][\w-]*)\b([^>]*?\s)(href|action|formaction)=(["'])(\/(?!\/)[^"']*)\4/gi,
    (match, tag, mid, attr, q, rootRelativePath) => {
      try {
        const absUrl = `${siteUrl.origin}${rootRelativePath}`;
        const proxied = `${appOrigin}/api/proxy?url=${encodeURIComponent(absUrl)}`;
        return `<${tag}${mid}${attr}=${q}${proxied}${q}`;
      } catch {
        return match;
      }
    }
  );
}

/** Absolute links to the reviewed site → proxy so the iframe document stays same-origin. */
function rewriteSameSiteAbsoluteNavUrlsToProxy(
  html: string,
  siteUrl: URL,
  appOrigin: string
): string {
  const hosts = hostVariants(siteUrl.host);
  for (const host of hosts) {
    const escHost = escapeRegExp(host);
    for (const proto of ["https:", "http:"]) {
      const origin = `${proto}//${host}`;
      const escOrigin = escapeRegExp(origin);
      html = html.replace(
        new RegExp(
          `<((?!link\\b)[a-zA-Z][\\w-]*)\\b([^>]*?\\s)(href|action|formaction)=(["'])(${escOrigin})([^"']*)\\4`,
          "gi"
        ),
        (_m, tag, mid, attr, q, _o, pathPart: string) => {
          const abs = origin + pathPart;
          if (abs.includes(`${appOrigin}/api/proxy`)) {
            return `<${tag}${mid}${attr}=${q}${origin}${pathPart}${q}`;
          }
          const proxied = `${appOrigin}/api/proxy?url=${encodeURIComponent(abs)}`;
          return `<${tag}${mid}${attr}=${q}${proxied}${q}`;
        }
      );
    }
    html = html.replace(
      new RegExp(
        `<((?!link\\b)[a-zA-Z][\\w-]*)\\b([^>]*?\\s)(href|action|formaction)=(["'])(//${escHost})([^"']*)\\4`,
        "gi"
      ),
      (_m, tag, mid, attr, q, _protoHost, rest: string) => {
        const path = rest && !rest.startsWith("/") ? `/${rest}` : rest || "/";
        const abs = new URL(path, `${siteUrl.protocol}//${host}`).toString();
        const proxied = `${appOrigin}/api/proxy?url=${encodeURIComponent(abs)}`;
        return `<${tag}${mid}${attr}=${q}${proxied}${q}`;
      }
    );
  }
  return html;
}

/** Resolve CSS url() / @import against the stylesheet URL, then serve via same-origin proxy. */
function rewriteCssUrls(css: string, baseUrl: URL, appOrigin: string): string {
  const wrap = (resolved: string): string => {
    try {
      const u = new URL(resolved);
      if (u.protocol !== "http:" && u.protocol !== "https:") return resolved;
      if (resolved.includes(`${appOrigin}/api/proxy`)) return resolved;
      return proxyAssetUrl(appOrigin, u.toString());
    } catch {
      return resolved;
    }
  };

  let out = css.replace(/url\(([^)]+)\)/gi, (full, rawInner) => {
    const inner = String(rawInner).trim().replace(/^['"]|['"]$/g, "");
    if (!inner || inner.startsWith("data:") || inner.startsWith("blob:")) {
      return full;
    }
    try {
      const resolved = new URL(inner, `${baseUrl.origin}${baseUrl.pathname}`).toString();
      return `url("${wrap(resolved)}")`;
    } catch {
      return full;
    }
  });
  // Also rewrite @import "..." and @import url(...) forms.
  out = out.replace(/@import\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?/gi, (full, rawImport) => {
    const inner = String(rawImport).trim();
    if (!inner || inner.startsWith("data:") || inner.startsWith("blob:")) return full;
    try {
      const resolved = new URL(inner, `${baseUrl.origin}${baseUrl.pathname}`).toString();
      return `@import url("${wrap(resolved)}")`;
    } catch {
      return full;
    }
  });
  return out;
}
