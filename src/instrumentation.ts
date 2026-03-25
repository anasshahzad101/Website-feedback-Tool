/**
 * Runs once per server cold start. Surfaces misconfiguration that causes Auth.js /api/auth/* to return 500.
 */
export async function register() {
  const onVercel = process.env.VERCEL === "1";
  const inProd = process.env.NODE_ENV === "production";
  if (!onVercel && !inProd) return;

  const secret =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    console.error(
      "[auth] Missing AUTH_SECRET (or NEXTAUTH_SECRET). Set a 32+ character random string in your host env (e.g. Hostinger Node app → Environment variables), then redeploy. Until then /api/auth/csrf returns 500 and login shows a generic error."
    );
  }

  if (!process.env.AUTH_URL?.trim() && !process.env.NEXTAUTH_URL?.trim()) {
    if (onVercel && process.env.VERCEL_URL) {
      process.env.AUTH_URL = `https://${process.env.VERCEL_URL}`;
      console.warn(
        `[auth] AUTH_URL was unset; using https://${process.env.VERCEL_URL} from VERCEL_URL. Set AUTH_URL and NEXT_PUBLIC_APP_URL explicitly for custom domains.`
      );
    } else if (!onVercel) {
      console.warn(
        "[auth] AUTH_URL (or NEXTAUTH_URL) is unset. Set it to your public HTTPS site URL (no trailing slash), e.g. https://yourdomain.com — required for Auth.js behind a reverse proxy."
      );
    } else {
      console.warn(
        "[auth] AUTH_URL is unset. Set it to your public site URL in environment variables."
      );
    }
  }
}
