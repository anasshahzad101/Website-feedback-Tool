import { NextRequest, NextResponse } from "next/server";

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

    if (isHtml) {
      let html = await response.text();

      // Drop meta CSP / frame policies that still block rendering inside our iframe
      html = html.replace(
        /<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi,
        ""
      );

      // Inject <base> tag so relative URLs resolve against the proxied origin
      const baseTag = `<base href="${targetUrl.origin}${targetUrl.pathname.substring(0, targetUrl.pathname.lastIndexOf("/") + 1)}" target="_self">`;

      // Rewrite absolute URLs of common resources to go through our proxy
      // Also inject base tag right after <head>
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/(<head[^>]*>)/i, `$1${baseTag}`);
      } else {
        html = baseTag + html;
      }

      // Rewrite resource URLs (images, scripts, stylesheets) to go through proxy
      // This handles absolute URLs to other origins that might have CSP issues
      html = rewriteResourceUrls(html, targetUrl);
      html = injectRuntimeRewriter(html, targetUrl);

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
      const rewrittenCss = rewriteCssUrls(css, targetUrl);
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

/**
 * Rewrite absolute URLs in HTML for scripts/styles/images
 * so they also pass through our proxy (avoiding CSP issues)
 */
function rewriteResourceUrls(html: string, baseUrl: URL): string {
  // Rewrite src= and href= attributes that are absolute external URLs
  // We leave relative URLs alone since the <base> tag handles those
  html = html.replace(
    /((?:src|href|action)=["'])(https?:\/\/[^"']+)(["'])/gi,
    (match, prefix, absUrl, suffix) => {
      try {
        // Always proxy absolute URLs (including same-origin assets) so they
        // load via our origin and avoid CORS issues inside the iframe.
        return `${prefix}/api/proxy?url=${encodeURIComponent(absUrl)}${suffix}`;
      } catch {
        return match;
      }
    }
  );

  // Rewrite srcset entries (absolute URLs)
  html = html.replace(/(srcset=["'])([^"']+)(["'])/gi, (match, prefix, value, suffix) => {
    const rewritten = String(value)
      .split(",")
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) return trimmed;
        const bits = trimmed.split(/\s+/);
        const candidate = bits[0] ?? "";
        if (!/^https?:\/\//i.test(candidate)) return trimmed;
        const proxied = `/api/proxy?url=${encodeURIComponent(candidate)}`;
        return [proxied, ...bits.slice(1)].join(" ");
      })
      .join(", ");
    return `${prefix}${rewritten}${suffix}`;
  });

  // Rewrite root-relative URLs (e.g. /wp-content/...) to proxied absolute URLs.
  // <base> does not affect root-relative paths, so without this they incorrectly
  // resolve to our own origin and 404.
  html = html.replace(
    /((?:src|href|action)=["'])(\/(?!\/)[^"']*)(["'])/gi,
    (match, prefix, rootRelativePath, suffix) => {
      try {
        const absUrl = `${baseUrl.origin}${rootRelativePath}`;
        return `${prefix}/api/proxy?url=${encodeURIComponent(absUrl)}${suffix}`;
      } catch {
        return match;
      }
    }
  );

  // Rewrite srcset entries (root-relative URLs)
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
        const proxied = `/api/proxy?url=${encodeURIComponent(absUrl)}`;
        return [proxied, ...bits.slice(1)].join(" ");
      })
      .join(", ");
    return `${prefix}${rewritten}${suffix}`;
  });

  return html;
}

/**
 * Rewrite CSS url(...) entries through our proxy so fonts/images from external
 * origins don't get blocked by browser CORS when loaded from our origin.
 */
function rewriteCssUrls(css: string, baseUrl: URL): string {
  let out = css.replace(/url\(([^)]+)\)/gi, (full, rawInner) => {
    const inner = String(rawInner).trim().replace(/^['"]|['"]$/g, "");
    if (!inner || inner.startsWith("data:") || inner.startsWith("blob:")) {
      return full;
    }
    try {
      const resolved = new URL(inner, `${baseUrl.origin}${baseUrl.pathname}`).toString();
      return `url("/api/proxy?url=${encodeURIComponent(resolved)}")`;
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
      return `@import url("/api/proxy?url=${encodeURIComponent(resolved)}")`;
    } catch {
      return full;
    }
  });
  return out;
}

function injectRuntimeRewriter(html: string, baseUrl: URL): string {
  const script = `<script>(function(){try{
const ORIGIN=${JSON.stringify(baseUrl.origin)};
const PROXY_PREFIX="/api/proxy?url=";
const isAlreadyProxied=(s)=>{const v=String(s||"").trim();return v.startsWith(PROXY_PREFIX)||v.includes("/api/proxy?url=");};
const toAbs=(u)=>{if(!u)return null;const s=String(u).trim();if(!s||s.startsWith("data:")||s.startsWith("blob:")||s.startsWith("javascript:"))return null;if(isAlreadyProxied(s))return null;try{return new URL(s,ORIGIN+"/").toString();}catch{return null;}};
const toProxy=(u)=>{const raw=String(u||"").trim();if(!raw||isAlreadyProxied(raw))return raw;const abs=toAbs(raw);return abs?PROXY_PREFIX+encodeURIComponent(abs):raw;};
const attrs=["src","href","action","poster","data-src","data-href","data-bg","data-background"];
const fixEl=(el)=>{if(!el||!el.getAttribute)return;
for(const a of attrs){const v=el.getAttribute(a);if(!v||isAlreadyProxied(v))continue;const p=toProxy(v);if(p&&p!==v)el.setAttribute(a,p);}
const ss=el.getAttribute("srcset");if(ss&&!ss.includes("/api/proxy?url=")){const next=ss.split(",").map(part=>{const t=part.trim();if(!t)return t;const bits=t.split(/\\s+/);const p=toProxy(bits[0]);return [p,...bits.slice(1)].join(" ");}).join(", ");if(next!==ss)el.setAttribute("srcset",next);}
if(el.tagName==="STYLE"&&el.textContent&&!el.textContent.includes("/api/proxy?url=")){el.textContent=el.textContent.replace(/url\\(([^)]+)\\)/gi,(m,inner)=>{const raw=String(inner).trim().replace(/^['"]|['"]$/g,"");const p=toProxy(raw);return p?('url("'+p+'")'):m;});}
};
document.querySelectorAll("*").forEach(fixEl);
const obs=new MutationObserver((mut)=>{for(const m of mut){if(m.addedNodes){m.addedNodes.forEach((n)=>{if(n&&n.nodeType===1){fixEl(n);n.querySelectorAll&&n.querySelectorAll("*").forEach(fixEl);}});}}});
obs.observe(document.documentElement,{subtree:true,childList:true});
}catch(e){console.warn("proxy runtime rewrite failed",e);}})();</script>`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${script}</head>`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/(<body[^>]*>)/i, `$1${script}`);
  }
  return `${script}${html}`;
}
