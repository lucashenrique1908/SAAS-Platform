import { NextResponse } from "next/server";

async function forward(request: Request) {
  const origin = request.headers.get("origin");
  if (
    request.method !== "GET" &&
    (!origin || origin !== new URL(request.url).origin)
  ) {
    return NextResponse.json(
      { message: "Request origin could not be verified." },
      { status: 403 },
    );
  }
  const sessionCookie = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)saas_session=([^;]+)/)?.[1];
  if (!sessionCookie)
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  const headers = new Headers({ cookie: `saas_session=${sessionCookie}` });
  if (origin) headers.set("origin", origin);
  if (request.method !== "GET") headers.set("x-csrf-protection", "1");
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  try {
    const upstream = await fetch(
      new URL(
        `/organizations${new URL(request.url).search}`,
        process.env.API_BASE_URL ?? "http://localhost:3001",
      ),
      {
        method: request.method,
        headers,
        body:
          request.method === "GET" ? undefined : await request.arrayBuffer(),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Organization service is temporarily unavailable." },
      { status: 502 },
    );
  }
}

export function GET(request: Request) {
  return forward(request);
}
export function POST(request: Request) {
  return forward(request);
}
