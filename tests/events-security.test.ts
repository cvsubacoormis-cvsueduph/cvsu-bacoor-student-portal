import { describe, it, expect, beforeEach } from "vitest";
import {
  setAuthUnauthenticated,
  setAuthAdmin,
  setAuthStudent,
  setAuthFaculty,
} from "../tests/__mocks__/clerk";
import { createMockRequest } from "./helpers";

const body = {
  title: "Test Event",
  dateFrom: new Date(),
  startTime: new Date(),
  endTime: new Date(),
};

describe("POST /api/events — Auth + Role guard", () => {
  let POST: (req: Request) => Promise<Response>;
  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/events/route");
    POST = mod.POST;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const res = await POST(createMockRequest("POST", "http://localhost/api/events", body));
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as student", async () => {
    setAuthStudent();
    const res = await POST(createMockRequest("POST", "http://localhost/api/events", body));
    expect(res.status).toBe(403);
  });

  it("allows admin to create", async () => {
    setAuthAdmin();
    const res = await POST(createMockRequest("POST", "http://localhost/api/events", body));
    expect(res.status).toBe(201);
  });
});

describe("DELETE /api/events — Auth + Role guard", () => {
  let DELETE: (req: Request) => Promise<Response>;
  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/events/route");
    DELETE = mod.DELETE;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const req = createMockRequest("DELETE", "http://localhost/api/events?id=1");
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as faculty", async () => {
    setAuthFaculty();
    const req = createMockRequest("DELETE", "http://localhost/api/events?id=1");
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("allows admin to delete", async () => {
    setAuthAdmin();
    const req = createMockRequest("DELETE", "http://localhost/api/events?id=1");
    const res = await DELETE(req);
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/events — Auth + Role guard", () => {
  let PUT: (req: Request) => Promise<Response>;
  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/events/route");
    PUT = mod.PUT;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const res = await PUT(createMockRequest("PUT", "http://localhost/api/events", { ...body, id: 1 }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as student", async () => {
    setAuthStudent();
    const res = await PUT(createMockRequest("PUT", "http://localhost/api/events", { ...body, id: 1 }));
    expect(res.status).toBe(403);
  });

  it("allows admin to update", async () => {
    setAuthAdmin();
    const res = await PUT(createMockRequest("PUT", "http://localhost/api/events", { ...body, id: 1, title: "Updated" }));
    expect(res.status).toBe(200);
  });
});
