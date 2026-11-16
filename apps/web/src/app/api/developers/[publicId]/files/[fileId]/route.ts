import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ publicId: string; fileId: string }> };
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: RouteContext) {
  const { publicId, fileId } = await context.params;
  if (!uuidPattern.test(publicId) || !uuidPattern.test(fileId)) {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }
  try {
    const upstream = await fetch(
      new URL(
        `/developers/${encodeURIComponent(publicId)}/files/${encodeURIComponent(fileId)}`,
        process.env.API_BASE_URL ?? "http://localhost:3001",
      ),
      { cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/octet-stream",
        "content-disposition":
          upstream.headers.get("content-disposition") ?? "attachment",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "File is temporarily unavailable." },
      { status: 502 },
    );
  }
}
