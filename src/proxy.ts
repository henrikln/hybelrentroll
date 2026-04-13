import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    console.log("[proxy] path:", pathname);

    // Public routes — no auth check
    if (
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/webhooks") ||
      pathname.startsWith("/api/internal") ||
      pathname.startsWith("/api/streetview") ||
      pathname.startsWith("/api/staticmap")
    ) {
      return NextResponse.next();
    }

    // Check for NextAuth session token
    const token =
      request.cookies.get("__Secure-authjs.session-token") ??
      request.cookies.get("authjs.session-token");

    if (!token) {
      console.log("[proxy] no token, redirecting to /sign-in");
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error("[proxy] error:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
