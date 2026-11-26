import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = (await cookies()).get("saas_session")?.value;
  if (!session)
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  try {
    const response = await fetch(
      new URL(
        "/barber-customer/me",
        process.env.API_BASE_URL ?? "http://localhost:3001",
      ),
      {
        headers: { cookie: `saas_session=${session}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Customer service is temporarily unavailable." },
      { status: 502 },
    );
  }
}
