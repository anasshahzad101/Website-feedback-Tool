import NextAuth from "next-auth";
import { authConfig } from "./config";

/** Non-empty secret only — empty string would block Auth.js env fallback and causes MissingSecret / CSRF 500. */
function resolvedAuthSecret(): string | undefined {
  const s =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  return s || undefined;
}

const secret = resolvedAuthSecret();

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  ...(secret ? { secret } : {}),
});

export { authConfig };
