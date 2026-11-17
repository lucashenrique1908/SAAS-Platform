import { afterEach, describe, expect, it, vi } from "vitest";
import { authRequest, getActionTokenFromHash } from "./auth-api";

describe("authRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the same-origin BFF, adds CSRF protection and never exposes a token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "ok" }), { status: 200 }),
      );

    await expect(
      authRequest("login", {
        method: "POST",
        body: JSON.stringify({
          email: "user@example.test",
          password: "a password",
        }),
      }),
    ).resolves.toEqual({ message: "ok" });

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/auth/login");
    expect(options?.credentials).toBe("same-origin");
    expect(new Headers(options?.headers).get("X-CSRF-Protection")).toBe("1");
    expect(JSON.stringify(options)).not.toContain("sessionToken");
  });

  it("reports safe API errors to the form", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid email or password." }), {
        status: 401,
      }),
    );

    await expect(authRequest("login")).rejects.toMatchObject({
      message: "Invalid email or password.",
      status: 401,
    });
  });
});

describe("getActionTokenFromHash", () => {
  it("reads one-time action tokens from the URL fragment", () => {
    expect(getActionTokenFromHash("#token=verification-value")).toBe(
      "verification-value",
    );
    expect(getActionTokenFromHash("")).toBeNull();
  });
});
