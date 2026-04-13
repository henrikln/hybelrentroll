import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/db";

const SUPER_ADMINS = ["henrikln@nagelgaarden.no"];

declare module "next-auth" {
  interface Session {
    accountId?: string;
    isAdmin?: boolean;
  }
  interface User {
    accountId?: string;
    isAdmin?: boolean;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return true;

      try {
        const email = user.email.toLowerCase();

        // Check if this email is already an allowed sender (belongs to an account)
        const existing = await prisma.allowedSender.findUnique({
          where: { email },
          include: { account: true },
        });

        let accountId: string;

        if (!existing) {
          // New user — create a new account (tenant)
          const account = await prisma.account.create({
            data: {
              name: user.name ?? email,
              allowedSenders: {
                create: { email, note: "Opprettet ved første innlogging" },
              },
            },
          });
          accountId = account.id;
        } else {
          accountId = existing.accountId;
        }

        // Ensure User record exists
        const isSuperAdmin = SUPER_ADMINS.includes(email);
        const dbUser = await prisma.user.upsert({
          where: { email },
          update: { name: user.name ?? undefined },
          create: {
            accountId,
            email,
            name: user.name ?? null,
            role: isSuperAdmin ? "admin" : "member",
          },
        });

        // Block deactivated users
        if (!dbUser.active) {
          return false;
        }

        user.accountId = accountId;
        user.isAdmin = dbUser.role === "admin";
      } catch (err) {
        console.error("[auth] Failed to resolve account:", err);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.accountId) {
        token.accountId = user.accountId;
        token.isAdmin = user.isAdmin;
      }
      // If accountId not in token yet (e.g. existing session), look it up
      if (!token.accountId && token.email) {
        const email = (token.email as string).toLowerCase();
        const sender = await prisma.allowedSender.findUnique({
          where: { email },
        });
        if (sender) {
          token.accountId = sender.accountId;
        }
        const dbUser = await prisma.user.findUnique({ where: { email } });
        if (dbUser) {
          token.isAdmin = dbUser.role === "admin";
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.accountId = token.accountId as string | undefined;
      session.isAdmin = token.isAdmin as boolean | undefined;
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;
      const isPublicRoute =
        pathname.startsWith("/sign-in") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/webhooks");

      if (isPublicRoute) return true;
      if (!isLoggedIn) {
        return Response.redirect(new URL("/sign-in", request.nextUrl.origin));
      }
      return true;
    },
  },
  session: {
    strategy: "jwt",
  },
});

/**
 * Get the current user's accountId from the session.
 * Use this in server components and API routes for tenant isolation.
 */
export async function getAccountId(): Promise<string | null> {
  const session = await auth();
  return session?.accountId ?? null;
}

/**
 * Check if the current user is an admin.
 */
export async function getIsAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.isAdmin === true;
}

/**
 * Require admin access. Returns accountId or throws redirect.
 */
export async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.isAdmin) {
    const { redirect } = await import("next/navigation");
    redirect("/");
  }
  return session.accountId!;
}
