import { vi } from "vitest";

export function createMockRequest(
  method: string,
  url: string,
  body?: unknown,
) {
  const parsedUrl = new URL(url);

  const req = new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  Object.defineProperty(req, "nextUrl", {
    value: {
      ...parsedUrl,
      searchParams: parsedUrl.searchParams,
      get: parsedUrl.searchParams.get.bind(parsedUrl.searchParams),
    },
    writable: true,
    configurable: true,
  });

  return req;
}
