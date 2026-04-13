import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const markers = req.nextUrl.searchParams.get("markers");
  if (!markers) {
    return NextResponse.json({ error: "Missing markers" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("size", "800x300");
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("key", apiKey);

  // Support multiple markers (pipe-separated addresses)
  const addresses = markers.split("|");
  for (const addr of addresses) {
    url.searchParams.append("markers", `color:red|${addr}`);
  }

  // Auto-fit all markers
  if (addresses.length === 1) {
    url.searchParams.set("zoom", "15");
    url.searchParams.set("center", addresses[0]);
  }

  const res = await fetch(url.toString());

  if (!res.ok) {
    return NextResponse.json({ error: "Static Map API error" }, { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "image/png",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
