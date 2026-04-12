import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    accountId?: string;
  }
}

declare module "next-auth" {
  interface User {
    accountId?: string;
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
          user.accountId = account.id;
        } else {
          user.accountId = existing.accountId;
        }
      } catch (err) {
        console.error("[auth] Failed to resolve account:", err);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.accountId) {
        token.accountId = user.accountId;
      }
      // If accountId not in token yet (e.g. existing session), look it up
      if (!token.accountId && token.email) {
        const sender = await prisma.allowedSender.findUnique({
          where: { email: (token.email as string).toLowerCase() },
        });
        if (sender) {
          token.accountId = sender.accountId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.accountId = token.accountId as string | undefined;
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
