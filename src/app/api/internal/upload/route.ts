import { NextRequest, NextResponse } from "next/server";
import { importRentRollToDb } from "@/lib/excel/db-importer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Ingen fil lastet opp" }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json({ error: "Kun .xlsx-filer støttes" }, { status: 400 });
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Filen er for stor (maks 10 MB)" }, { status: 400 });
    }

    // Find or create account for current user
    const account = await getOrCreateAccount(session.user.email, session.user.name ?? undefined);

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importRentRollToDb(buffer, account.id, {
      filename: file.name,
      source: "upload",
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Feil ved behandling av fil" },
      { status: 500 }
    );
  }
}

/**
 * Ensure an account exists for the signed-in user.
 * Auto-creates account + allowed_sender on first upload.
 */
async function getOrCreateAccount(email: string, name?: string) {
  // Check if this user's email is an allowed sender
  const sender = await prisma.allowedSender.findUnique({
    where: { email: email.toLowerCase() },
    include: { account: true },
  });

  if (sender) return sender.account;

  // No account yet — create one
  const account = await prisma.account.create({
    data: {
      name: name ?? email,
      // Also add user as allowed sender so they can email in rent rolls
      allowedSenders: {
        create: {
          email: email.toLowerCase(),
          note: "Auto-created from first upload",
        },
      },
    },
  });

  return account;
}
