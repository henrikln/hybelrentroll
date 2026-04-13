import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { prisma } from "@/lib/db";

const SUPER_ADMINS = (process.env.SUPER_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

declare module "next-auth" {
  interface Session {
    accountId?: string;
    isAdmin?: boolean;
    isGlobalAdmin?: boolean;
  }
  interface User {
    accountId?: string;
    isAdmin?: boolean;
    isGlobalAdmin?: boolean;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    MicrosoftEntraID,
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

        if (existing) {
          accountId = existing.accountId;
        } else {
          // Check if user was added via admin panel (has a User record already)
          const existingUser = await prisma.user.findUnique({
            where: { email },
          });
          if (existingUser) {
            accountId = existingUser.accountId;
          } else {
            // Truly new user — create a new account (tenant)
            const account = await prisma.account.create({
              data: {
                name: user.name ?? email,
                allowedSenders: {
                  create: { email, note: "Opprettet ved første innlogging" },
                },
              },
            });
            accountId = account.id;
          }
        }

        // Ensure User record exists
        const isSuperAdmin = SUPER_ADMINS.includes(email);
        const dbUser = await prisma.user.upsert({
          where: { email },
          update: { name: user.name ?? undefined, lastLoginAt: new Date() },
          create: {
            accountId,
            email,
            name: user.name ?? null,
            role: isSuperAdmin ? "admin" : "member",
            globalAdmin: isSuperAdmin,
          },
        });

        // Block deactivated users
        if (!dbUser.active) {
          return false;
        }

        user.accountId = accountId;
        user.isAdmin = dbUser.role === "admin";
        user.isGlobalAdmin = dbUser.globalAdmin;
      } catch (err) {
        console.error("[auth] Failed to resolve account:", err);
        return false;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.accountId) {
        token.accountId = user.accountId;
        token.isAdmin = user.isAdmin;
        token.isGlobalAdmin = user.isGlobalAdmin;
      }
      // If accountId or isGlobalAdmin not in token yet (e.g. existing session), look it up
      if (token.email && (!token.accountId || token.isGlobalAdmin === undefined)) {
        const email = (token.email as string).toLowerCase();
        // Try User table first (covers users added via admin panel)
        const dbUser = await prisma.user.findUnique({ where: { email } });
        if (dbUser) {
          if (!token.accountId) token.accountId = dbUser.accountId;
          token.isAdmin = dbUser.role === "admin";
          token.isGlobalAdmin = dbUser.globalAdmin;
        }
        // Fall back to allowedSender if no User record
        if (!token.accountId) {
          const sender = await prisma.allowedSender.findUnique({
            where: { email },
          });
          if (sender) {
            token.accountId = sender.accountId;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.accountId = token.accountId as string | undefined;
      session.isAdmin = token.isAdmin as boolean | undefined;
      session.isGlobalAdmin = token.isGlobalAdmin as boolean | undefined;
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
 * Require admin access (global or tenant). Returns accountId or throws redirect.
 */
export async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.isAdmin) {
    const { redirect } = await import("next/navigation");
    redirect("/");
  }
  return session!.accountId!;
}

/**
 * Check if the current user is a global admin.
 */
export async function getIsGlobalAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.isGlobalAdmin === true;
}

/**
 * Require global admin access. Returns accountId or throws redirect.
 */
export async function requireGlobalAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.isGlobalAdmin) {
    const { redirect } = await import("next/navigation");
    redirect("/");
  }
  return session!.accountId!;
}
