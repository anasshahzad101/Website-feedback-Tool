import { NextAuthConfig } from "next-auth";
import { compare } from "bcryptjs";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db/client";
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
    authorized({ auth }) {
      return !!auth;
    },
    session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        session.user.role = token.role as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
      }
      return session;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = user as any;
        token.role = u.role;
        token.firstName = u.firstName;
        token.lastName = u.lastName;
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
  // Remove __Host- cookie prefix so cookies work correctly behind PHP reverse proxy
  cookies: {
    csrfToken: {
      name: "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: true,
      },
    },
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: true,
      },
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: true,
      },
    },
  },
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
