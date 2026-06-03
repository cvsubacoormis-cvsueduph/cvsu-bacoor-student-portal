import { describe, it, expect, beforeEach } from "vitest";
import {
  setAuthUnauthenticated,
  setAuthAdmin,
  setAuthStudent,
  setAuthFaculty,
} from "../tests/__mocks__/clerk";
import { createMockRequest } from "./helpers";

const body = { title: "Test", category: "General", content: "Desc", important: false, author: "Admin" };

describe("POST /api/news — Role guard", () => {
  let POST: (req: Request) => Promise<Response>;
  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/news/route");
    POST = mod.POST;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const res = await POST(createMockRequest("POST", "http://localhost/api/news", body));
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as student", async () => {
    setAuthStudent();
    const res = await POST(createMockRequest("POST", "http://localhost/api/news", body));
    expect(res.status).toBe(403);
  });

  it("allows admin to create", async () => {
    setAuthAdmin();
    const res = await POST(createMockRequest("POST", "http://localhost/api/news", body));
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/news — Role guard", () => {
  let PATCH: (req: Request) => Promise<Response>;
  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/news/route");
    PATCH = mod.PATCH;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const res = await PATCH(createMockRequest("PATCH", "http://localhost/api/news", { ...body, id: 1 }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as faculty", async () => {
    setAuthFaculty();
    const res = await PATCH(createMockRequest("PATCH", "http://localhost/api/news", { ...body, id: 1 }));
    expect(res.status).toBe(403);
  });

  it("allows admin to update", async () => {
    setAuthAdmin();
    const res = await PATCH(createMockRequest("PATCH", "http://localhost/api/news", { ...body, id: 1 }));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/news — Role guard", () => {
  let DELETE: (req: Request) => Promise<Response>;
  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/news/route");
    DELETE = mod.DELETE;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const res = await DELETE(createMockRequest("DELETE", "http://localhost/api/news", { id: 1 }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as student", async () => {
    setAuthStudent();
    const res = await DELETE(createMockRequest("DELETE", "http://localhost/api/news", { id: 1 }));
    expect(res.status).toBe(403);
  });

  it("allows admin to delete", async () => {
    setAuthAdmin();
    const res = await DELETE(createMockRequest("DELETE", "http://localhost/api/news", { id: 1 }));
    expect(res.status).toBe(200);
  });
});
