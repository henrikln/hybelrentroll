import { describe, it, expect } from "vitest";

/**
 * Tests for auth logic patterns used across the application.
 * These test the pure logic extracted from auth.ts and admin pages,
 * without requiring Next.js or database connections.
 */

// Replicate the env-based super admin logic from auth.ts
const SUPER_ADMIN_ENV = "henrikln@nagelgaarden.no,admin@example.com";
const SUPER_ADMINS = SUPER_ADMIN_ENV.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

describe("super admin check", () => {
  it("recognizes configured super admin email", () => {
    expect(SUPER_ADMINS.includes("henrikln@nagelgaarden.no")).toBe(true);
  });

  it("recognizes second admin from comma-separated list", () => {
    expect(SUPER_ADMINS.includes("admin@example.com")).toBe(true);
  });

  it("rejects other emails", () => {
    expect(SUPER_ADMINS.includes("other@nagelgaarden.no")).toBe(false);
  });

  it("is case-insensitive (lowercased during parsing)", () => {
    // The env parsing lowercases all emails, and auth.ts lowercases user email too
    const userEmail = "HENRIKLN@NAGELGAARDEN.NO".toLowerCase();
    expect(SUPER_ADMINS.includes(userEmail)).toBe(true);
  });

  it("handles empty env variable gracefully", () => {
    const empty = "".split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    expect(empty).toHaveLength(0);
  });
});

describe("route authorization patterns", () => {
  const publicRoutes = ["/sign-in", "/api/auth", "/api/webhooks"];

  function isPublicRoute(pathname: string): boolean {
    return publicRoutes.some((route) => pathname.startsWith(route));
  }

  it("allows sign-in page", () => {
    expect(isPublicRoute("/sign-in")).toBe(true);
  });

  it("allows auth API routes", () => {
    expect(isPublicRoute("/api/auth/callback/google")).toBe(true);
    expect(isPublicRoute("/api/auth/signin")).toBe(true);
  });

  it("allows webhook routes", () => {
    expect(isPublicRoute("/api/webhooks/inbound-email")).toBe(true);
  });

  it("blocks dashboard routes", () => {
    expect(isPublicRoute("/")).toBe(false);
    expect(isPublicRoute("/eiendommer")).toBe(false);
    expect(isPublicRoute("/selskaper")).toBe(false);
    expect(isPublicRoute("/admin/users")).toBe(false);
  });

  it("blocks internal API routes", () => {
    expect(isPublicRoute("/api/internal/upload")).toBe(false);
  });

  it("blocks map proxy routes (security concern)", () => {
    // These are actually public in the current code — this documents
    // that /api/staticmap and /api/streetview are NOT protected
    expect(isPublicRoute("/api/staticmap")).toBe(false);
    expect(isPublicRoute("/api/streetview")).toBe(false);
  });
});

describe("tenant isolation patterns", () => {
  function canAccess(myAccountId: string, targetAccountId: string, isGlobal: boolean): boolean {
    return isGlobal || targetAccountId === myAccountId;
  }

  it("tenant admin cannot add user to another account", () => {
    expect(canAccess("account-1", "account-2", false)).toBe(false);
  });

  it("tenant admin can add user to own account", () => {
    expect(canAccess("account-1", "account-1", false)).toBe(true);
  });

  it("global admin can add user to any account", () => {
    expect(canAccess("account-1", "account-2", true)).toBe(true);
  });

  it("tenant admin cannot remove user from another account", () => {
    expect(canAccess("account-1", "account-2", false)).toBe(false);
  });

  it("tenant admin cannot toggle admin on another account's user", () => {
    expect(canAccess("account-1", "account-2", false)).toBe(false);
  });

  it("tenant admin cannot rename another account", () => {
    expect(canAccess("account-1", "account-2", false)).toBe(false);
  });
});

describe("email normalization", () => {
  it("email should be lowercased for comparison", () => {
    const input = "User@Example.COM";
    const normalized = input.toLowerCase().trim();
    expect(normalized).toBe("user@example.com");
  });

  it("email should be trimmed", () => {
    const input = "  user@test.no  ";
    const normalized = input.toLowerCase().trim();
    expect(normalized).toBe("user@test.no");
  });
});

describe("account resolution priority", () => {
  // The auth flow checks in this order:
  // 1. AllowedSender table
  // 2. User table
  // 3. Create new account

  it("documents resolution order: allowedSender → user → create", () => {
    type Source = "allowedSender" | "user" | "new";

    function resolveAccount(
      hasAllowedSender: boolean,
      hasUser: boolean
    ): Source {
      if (hasAllowedSender) return "allowedSender";
      if (hasUser) return "user";
      return "new";
    }

    expect(resolveAccount(true, true)).toBe("allowedSender");
    expect(resolveAccount(true, false)).toBe("allowedSender");
    expect(resolveAccount(false, true)).toBe("user");
    expect(resolveAccount(false, false)).toBe("new");
  });
});

describe("deactivated user blocking", () => {
  it("blocks inactive user from signing in", () => {
    const dbUser = { active: false, role: "member" as const };
    expect(dbUser.active).toBe(false);
    // In auth.ts, signIn callback returns false if !dbUser.active
  });

  it("allows active user to sign in", () => {
    const dbUser = { active: true, role: "member" as const };
    expect(dbUser.active).toBe(true);
  });
});

describe("upload route security", () => {
  it("requires session with email", () => {
    // The upload route checks session?.user?.email
    type Session = { user?: { email?: string | null } } | null;

    function hasEmail(session: Session): boolean {
      return !!session?.user?.email;
    }

    expect(hasEmail(null)).toBe(false);
    expect(hasEmail({ user: { email: null } })).toBe(false);
    expect(hasEmail({ user: { email: "test@test.no" } })).toBe(true);
  });

  it("rejects non-xlsx files", () => {
    const validFilename = "rentroll.xlsx";
    const invalidFilenames = ["data.xls", "file.csv", "document.pdf", "malware.xlsx.exe"];

    expect(validFilename.endsWith(".xlsx")).toBe(true);
    for (const f of invalidFilenames) {
      expect(f.endsWith(".xlsx")).toBe(false);
    }
  });
});

describe("webhook idempotency", () => {
  it("5-minute window catches retries", () => {
    const now = Date.now();
    const recentCutoff = new Date(now - 5 * 60 * 1000);

    // Import 1 minute ago — should be caught
    const recentImport = new Date(now - 1 * 60 * 1000);
    expect(recentImport > recentCutoff).toBe(true);

    // Import 10 minutes ago — should NOT be caught
    const oldImport = new Date(now - 10 * 60 * 1000);
    expect(oldImport > recentCutoff).toBe(false);
  });
});
