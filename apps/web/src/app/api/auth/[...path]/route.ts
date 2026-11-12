import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "saas_session";
const allowedRoutes = new Set([
  "register",
  "resend-verification",
  "verify-email",
  "login",
  "logout",
  "me",
  "forgot-password",
  "reset-password",
  "sessions",
  "logout-all",
]);
const sessionIdPattern =
  /^sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function forwardAuthRequest(
  request: Request,
  pathPromise: Promise<{ path: string[] }>,
): Promise<Response> {
  const { path } = await pathPromise;
  const route = path.join("/");
  if (!allowedRoutes.has(route) && !sessionIdPattern.test(route)) {
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

  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
  const target = new URL(
    `/auth/${path.map((segment) => encodeURIComponent(segment)).join("/")}`,
    apiBaseUrl,
  );
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const requestSessionCookie = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)saas_session=([^;]+)/)?.[1];
  if (requestSessionCookie) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${requestSessionCookie}`);
  }
  if (origin) {
    headers.set("origin", origin);
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    headers.set("x-csrf-protection", "1");
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method)
        ? undefined
        : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json(
      { message: "Authentication service is temporarily unavailable." },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers({
    "cache-control": "no-store",
  });
  const responseType = upstream.headers.get("content-type");
  if (responseType) {
    responseHeaders.set("content-type", responseType);
  }
  const responseSessionCookie = upstream.headers.get("set-cookie");
  if (responseSessionCookie) {
    responseHeaders.set("set-cookie", responseSessionCookie);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext) {
  return forwardAuthRequest(request, context.params);
}

export async function POST(request: Request, context: RouteContext) {
  return forwardAuthRequest(request, context.params);
}

export async function DELETE(request: Request, context: RouteContext) {
  return forwardAuthRequest(request, context.params);
}
