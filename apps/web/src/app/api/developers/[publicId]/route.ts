import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ publicId: string }> };
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: RouteContext) {
  const { publicId } = await context.params;
  if (!uuidPattern.test(publicId)) {
    return NextResponse.json(
      { message: "Developer profile not found." },
      { status: 404 },
    );
  }
  try {
    const upstream = await fetch(
      new URL(
        `/developers/${encodeURIComponent(publicId)}`,
        process.env.API_BASE_URL ?? "http://localhost:3001",
      ),
      { cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Developer profiles are temporarily unavailable." },
      { status: 502 },
    );
  }
}
