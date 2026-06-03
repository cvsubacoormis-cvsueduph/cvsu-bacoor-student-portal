import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setAuthUnauthenticated,
  setAuthAdmin,
  setAuthStudent,
} from "../tests/__mocks__/clerk";
import { rateLimiterConsume } from "../tests/__mocks__/rate-limiter";
import { createMockRequest } from "./helpers";

describe("Rate Limit — API Routes (429 responses)", () => {
  describe("DELETE /api/students", () => {
    let DELETE: (req: Request) => Promise<Response>;

    beforeEach(async () => {
      rateLimiterConsume.mockResolvedValue(undefined);
      setAuthAdmin();
      const mod = await import("@/app/api/students/route");
      DELETE = mod.DELETE;
    });

    it("returns 429 when rate limit exceeded", async () => {
      rateLimiterConsume.mockRejectedValue({
        msBeforeNext: 45000,
      });

      const req = createMockRequest("DELETE", "http://localhost/api/students?id=test");
      const res = await DELETE(req);

      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("45");

      const body = await res.json();
      expect(body.error).toContain("Too many requests");
      expect(body.error).toContain("45 seconds");
      expect(body.retryAfter).toBe(45);
    });

    it("returns 200 when rate limit not exceeded", async () => {
      rateLimiterConsume.mockResolvedValue(undefined);

      const req = createMockRequest("DELETE", "http://localhost/api/students?id=test");
      const res = await DELETE(req);

      expect(res.status).not.toBe(429);
    });
  });

  describe("DELETE /api/bulk-delete", () => {
    let DELETE: () => Promise<Response>;

    beforeEach(async () => {
      rateLimiterConsume.mockResolvedValue(undefined);
      setAuthAdmin();
      const mod = await import("@/app/api/bulk-delete/route");
      DELETE = mod.DELETE;
    });

    it("returns 429 when rate limit exceeded", async () => {
      rateLimiterConsume.mockRejectedValue({
        msBeforeNext: 280000,
      });

      const res = await DELETE();

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toContain("Too many requests");
      expect(body.error).toContain("280 seconds");
      expect(body.retryAfter).toBe(280);
    });
  });

  describe("POST /api/announcements", () => {
    let POST: (req: Request) => Promise<Response>;

    beforeEach(async () => {
      rateLimiterConsume.mockResolvedValue(undefined);
      setAuthAdmin();
      const mod = await import("@/app/api/announcements/route");
      POST = mod.POST;
    });

    it("returns 429 with informative message when rate limited", async () => {
      rateLimiterConsume.mockRejectedValue({
        msBeforeNext: 12000,
      });

      const body = { title: "Test", dateFrom: new Date(), startTime: new Date(), endTime: new Date() };
      const res = await POST(createMockRequest("POST", "http://localhost/api/announcements", body));

      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.error).toContain("12 seconds");
    });
  });

  describe("POST /api/events", () => {
    let POST: (req: Request) => Promise<Response>;

    beforeEach(async () => {
      rateLimiterConsume.mockResolvedValue(undefined);
      setAuthAdmin();
      const mod = await import("@/app/api/events/route");
      POST = mod.POST;
    });

    it("returns 429 when rate limited", async () => {
      rateLimiterConsume.mockRejectedValue({ msBeforeNext: 30000 });

      const body = { title: "Test", dateFrom: new Date(), startTime: new Date(), endTime: new Date() };
      const res = await POST(createMockRequest("POST", "http://localhost/api/events", body));

      expect(res.status).toBe(429);
    });
  });

  describe("POST /api/news", () => {
    let POST: (req: Request) => Promise<Response>;

    beforeEach(async () => {
      rateLimiterConsume.mockResolvedValue(undefined);
      setAuthAdmin();
      const mod = await import("@/app/api/news/route");
      POST = mod.POST;
    });

    it("returns 429 when rate limited", async () => {
      rateLimiterConsume.mockRejectedValue({ msBeforeNext: 20000 });

      const body = { title: "Test", category: "General", content: "X", important: false, author: "A" };
      const res = await POST(createMockRequest("POST", "http://localhost/api/news", body));

      expect(res.status).toBe(429);
    });
  });

  describe("GET /api/check-approval", () => {
    let GET: () => Promise<Response>;

    beforeEach(async () => {
      rateLimiterConsume.mockResolvedValue(undefined);
      setAuthStudent();
      const mod = await import("@/app/api/check-approval/route");
      GET = mod.GET;
    });

    it("returns 429 when polling too fast", async () => {
      rateLimiterConsume.mockRejectedValue({ msBeforeNext: 55000 });

      const res = await GET();
      expect(res.status).toBe(429);
    });
  });
});

describe("Rate Limit — Auth and Role guard still takes priority", () => {
  it("returns 401 before 429 when unauthenticated", async () => {
    rateLimiterConsume.mockRejectedValue({ msBeforeNext: 10000 });
    setAuthUnauthenticated();

    const mod = await import("@/app/api/students/route");
    const req = createMockRequest("DELETE", "http://localhost/api/students?id=test");
    const res = await mod.DELETE(req);

    // MUST be 401, not 429 — auth check runs first
    expect(res.status).toBe(401);
  });

  it("returns 403 before 429 when unauthorized role", async () => {
    rateLimiterConsume.mockRejectedValue({ msBeforeNext: 10000 });
    setAuthStudent();

    const mod = await import("@/app/api/announcements/route");
    const body = { title: "Test", dateFrom: new Date(), startTime: new Date(), endTime: new Date() };
    const res = await mod.POST(createMockRequest("POST", "http://localhost/api/announcements", body));

    // MUST be 403, not 429 — role check runs first
    expect(res.status).toBe(403);
  });
});
