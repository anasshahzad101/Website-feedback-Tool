/**
 * Runs once per server cold start. Surfaces misconfiguration that causes Auth.js /api/auth/* to return 500.
 */
export async function register() {
  if (process.env.VERCEL !== "1") return;

  const secret =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    console.error(
      "[auth] Missing AUTH_SECRET (or NEXTAUTH_SECRET). Add a 32+ character random string in Vercel → Settings → Environment Variables, then redeploy. Until then /api/auth/csrf returns 500."
    );
  }

  if (!process.env.AUTH_URL?.trim() && !process.env.NEXTAUTH_URL?.trim()) {
    if (process.env.VERCEL_URL) {
      process.env.AUTH_URL = `https://${process.env.VERCEL_URL}`;
      console.warn(
        `[auth] AUTH_URL was unset; using https://${process.env.VERCEL_URL} from VERCEL_URL. Set AUTH_URL and NEXT_PUBLIC_APP_URL explicitly for custom domains.`
      );
    } else {
      console.warn(
        "[auth] AUTH_URL is unset. Set it to your public site URL (e.g. https://your-app.vercel.app) in Vercel env."
      );
    }
  }
}
