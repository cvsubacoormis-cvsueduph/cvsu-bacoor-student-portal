import { describe, it, expect, beforeEach } from "vitest";
import {
  setAuthUnauthenticated,
  setAuthStudent,
} from "../tests/__mocks__/clerk";

describe("GET /api/check-approval — Clerk auth (no x-user-id)", () => {
  let GET: () => Promise<Response>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/check-approval/route");
    GET = mod.GET;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("succeeds when authenticated via Clerk", async () => {
    setAuthStudent();
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
