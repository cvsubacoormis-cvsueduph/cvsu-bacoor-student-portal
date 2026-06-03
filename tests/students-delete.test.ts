import { describe, it, expect, beforeEach } from "vitest";
import {
  setAuthUnauthenticated,
  setAuthAdmin,
  setAuthStudent,
  setAuthFaculty,
} from "../tests/__mocks__/clerk";
import { createMockRequest } from "./helpers";

describe("DELETE /api/students — Authorization", () => {
  let DELETE: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/students/route");
    DELETE = mod.DELETE;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const req = createMockRequest("DELETE", "http://localhost/api/students?id=test-123");
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as student", async () => {
    setAuthStudent();
    const req = createMockRequest("DELETE", "http://localhost/api/students?id=test-123");
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when authenticated as faculty", async () => {
    setAuthFaculty();
    const req = createMockRequest("DELETE", "http://localhost/api/students?id=test-123");
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("allows admin to delete (auth + role pass, returns 200)", async () => {
    setAuthAdmin();
    const req = createMockRequest("DELETE", "http://localhost/api/students?id=test-123");
    const res = await DELETE(req);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("returns 400 when no id provided", async () => {
    setAuthAdmin();
    const req = createMockRequest("DELETE", "http://localhost/api/students");
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
