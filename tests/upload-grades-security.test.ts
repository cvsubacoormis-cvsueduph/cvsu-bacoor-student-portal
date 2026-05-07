import { describe, it, expect, beforeEach } from "vitest";
import {
  setAuthUnauthenticated,
  setAuthAdmin,
  setAuthFaculty,
} from "../tests/__mocks__/clerk";
import { rateLimiterConsume } from "../tests/__mocks__/rate-limiter";

describe("POST /api/upload-grades — Rate limiting for all roles", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    rateLimiterConsume.mockResolvedValue(undefined);
    setAuthUnauthenticated();
    const mod = await import("@/app/api/upload-grades/route");
    POST = mod.POST;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const req = new Request("http://localhost/api/upload-grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{
        studentNumber: "123456789",
        courseCode: "IT101",
        courseTitle: "Intro to IT",
        creditUnit: 3,
        grade: "1.00",
        instructor: "Test",
        academicYear: "AY_2024_2025",
        semester: "FIRST",
      }]),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("applies rate limiting to admin role (was previously bypassed)", async () => {
    setAuthAdmin();
    rateLimiterConsume.mockRejectedValue({ msBeforeNext: 1000 });

    const req = new Request("http://localhost/api/upload-grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{
        studentNumber: "123456789",
        courseCode: "IT101",
        courseTitle: "Intro to IT",
        creditUnit: 3,
        grade: "1.00",
        instructor: "Test",
        academicYear: "AY_2024_2025",
        semester: "FIRST",
      }]),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("applies rate limiting to faculty role", async () => {
    setAuthFaculty();
    rateLimiterConsume.mockRejectedValue({ msBeforeNext: 1000 });

    const req = new Request("http://localhost/api/upload-grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{
        studentNumber: "123456789",
        courseCode: "IT101",
        courseTitle: "Intro to IT",
        creditUnit: 3,
        grade: "1.00",
        instructor: "Test",
        academicYear: "AY_2024_2025",
        semester: "FIRST",
      }]),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});
