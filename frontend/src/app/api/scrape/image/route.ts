import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Proxy a single image through our server so the browser can run it through
 * background removal (and later draw it into a canvas) without hitting
 * cross-origin restrictions on arbitrary brand CDNs.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response("Missing url parameter", { status: 400 });
  }
  try {
    new URL(url);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) {
      return new Response(`Upstream ${upstream.status}`, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buffer = await upstream.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return new Response(`Fetch failed: ${msg}`, { status: 502 });
  }
}
