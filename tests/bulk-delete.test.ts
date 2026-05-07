import { describe, it, expect, beforeEach } from "vitest";
import {
  setAuthUnauthenticated,
  setAuthAdmin,
  setAuthStudent,
  setAuthFaculty,
  setAuthRegistrar,
} from "../tests/__mocks__/clerk";

describe("DELETE /api/bulk-delete — Authorization", () => {
  let DELETE: () => Promise<Response>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/bulk-delete/route");
    DELETE = mod.DELETE;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as student", async () => {
    setAuthStudent();
    const res = await DELETE();
    expect(res.status).toBe(403);
  });

  it("returns 403 when authenticated as faculty", async () => {
    setAuthFaculty();
    const res = await DELETE();
    expect(res.status).toBe(403);
  });

  it("returns 403 when authenticated as registrar (not admin/superuser)", async () => {
    setAuthRegistrar();
    const res = await DELETE();
    expect(res.status).toBe(403);
  });

  it("allows admin to delete", async () => {
    setAuthAdmin();
    const res = await DELETE();
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
