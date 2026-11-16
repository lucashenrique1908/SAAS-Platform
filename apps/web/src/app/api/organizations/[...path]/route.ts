import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "saas_session";
const segmentPattern = /^[a-zA-Z0-9-]+$/;
type RouteContext = { params: Promise<{ path: string[] }> };

async function forwardOrganizationRequest(
  request: Request,
  context: RouteContext,
) {
  const { path } = await context.params;
  if (!path.length || path.some((segment) => !segmentPattern.test(segment))) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const origin = request.headers.get("origin");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
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
  if (!sessionCookie) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  const upstreamHeaders = new Headers({
    cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}`,
  });
  const contentType = request.headers.get("content-type");
  if (contentType) upstreamHeaders.set("content-type", contentType);
  if (origin) upstreamHeaders.set("origin", origin);
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    upstreamHeaders.set("x-csrf-protection", "1");
  }

  const target = new URL(
    `/organizations/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`,
    process.env.API_BASE_URL ?? "http://localhost:3001",
  );
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: upstreamHeaders,
      body: ["GET", "HEAD"].includes(request.method)
        ? undefined
        : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json(
      { message: "Organization service is temporarily unavailable." },
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

export function GET(request: Request, context: RouteContext) {
  return forwardOrganizationRequest(request, context);
}

export function POST(request: Request, context: RouteContext) {
  return forwardOrganizationRequest(request, context);
}

export function PATCH(request: Request, context: RouteContext) {
  return forwardOrganizationRequest(request, context);
}

export function PUT(request: Request, context: RouteContext) {
  return forwardOrganizationRequest(request, context);
}

export function DELETE(request: Request, context: RouteContext) {
  return forwardOrganizationRequest(request, context);
}
