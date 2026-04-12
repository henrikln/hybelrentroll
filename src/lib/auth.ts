import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/db";

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

      // Auto-create account + allowed sender on first sign-in
      try {
        const email = user.email.toLowerCase();
        const existing = await prisma.allowedSender.findUnique({
          where: { email },
        });

        if (!existing) {
          await prisma.account.create({
            data: {
              name: user.name ?? email,
              allowedSenders: {
                create: { email, note: "Auto-registrert ved innlogging" },
              },
            },
          });
        }
      } catch (err) {
        console.error("[auth] Failed to auto-register allowed sender:", err);
      }

      return true;
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
});
