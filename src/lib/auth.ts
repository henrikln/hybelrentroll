import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

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
