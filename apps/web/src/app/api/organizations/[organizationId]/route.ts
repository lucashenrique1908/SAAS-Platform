import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { message: "Request origin could not be verified." },
      { status: 403 },
    );
  }

  const { organizationId } = await context.params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      organizationId,
    )
  ) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }
  const sessionCookie = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)saas_session=([^;]+)/)?.[1];
  if (!sessionCookie) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      new URL(
        `/organizations/${encodeURIComponent(organizationId)}`,
        process.env.API_BASE_URL ?? "http://localhost:3001",
      ),
      {
        headers: {
          cookie: `saas_session=${sessionCookie}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    return NextResponse.json(
      { message: "Authentication service is temporarily unavailable." },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}
