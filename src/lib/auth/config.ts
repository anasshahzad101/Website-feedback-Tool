import { NextAuthConfig } from "next-auth";
import { compare } from "bcryptjs";
import Credentials from "next-auth/providers/credentials";
import { ZodError } from "zod";
import { signInSchema } from "@/lib/validations/auth";

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          const { db } = await import("@/lib/db/client");
          const { email, password } = await signInSchema.parseAsync(credentials);

          const user = await db.user.findUnique({
            where: { email, isActive: true },
          });

          if (!user) {
            return null;
          }

          const isValidPassword = await compare(password, user.passwordHash);

          if (!isValidPassword) {
            return null;
          }

          // Update last login
          await db.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            name: `${user.firstName} ${user.lastName}`,
          };
        } catch (error) {
          if (error instanceof ZodError) {
            return null;
          }
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        session.user.role = token.role as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = user as any;
        token.role = u.role;
        token.firstName = u.firstName;
        token.lastName = u.lastName;
        return token;
      }
      // Stale cookies / older tokens may omit `role`; backfill so permission checks work.
      const sub = token.sub;
      const roleMissing =
        token.role === undefined || token.role === null || token.role === "";
      if (typeof sub === "string" && sub && roleMissing) {
        const { db } = await import("@/lib/db/client");
        const row = await db.user.findUnique({
          where: { id: sub },
          select: { role: true, firstName: true, lastName: true },
        });
        if (row) {
          token.role = row.role;
          if (!token.firstName) token.firstName = row.firstName;
          if (!token.lastName) token.lastName = row.lastName;
        }
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  trustHost: true,
};

// Extend the session type
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      name?: string | null;
      image?: string | null;
    };
  }
}
