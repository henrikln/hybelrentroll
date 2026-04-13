import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/streetview");
  url.searchParams.set("size", "600x300");
  url.searchParams.set("location", `${address}, Norway`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("source", "outdoor");
  const fov = req.nextUrl.searchParams.get("fov");
  if (fov) url.searchParams.set("fov", fov);

  const res = await fetch(url.toString());

  if (!res.ok) {
    const body = await res.text();
    console.error(`[streetview] Google API ${res.status}: ${body}`);
    return NextResponse.json({ error: "Street View API error", details: body }, { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
