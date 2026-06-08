import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  setAuthUnauthenticated,
  setAuthAdmin,
  setAuthFaculty,
} from "../tests/__mocks__/clerk";
import { redis } from "@/lib/redis";

// ── Sample state for round-trip tests ──────────────────────────────────────

const sampleState = {
  fileName: "grades.xlsx",
  fileSize: 12345,
  previewData: [
    { studentNumber: "2020-0001", courseCode: "CS101", grade: "1.00" },
  ],
  academicYear: "AY_2025_2026",
  semester: "FIRST",
  allowLegacy: false,
  uploadResults: [],
  logs: [],
  hasValidated: false,
  progress: 0,
  processedCount: 0,
  totalRecords: 1,
  timestamp: Date.now(),
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("API /api/upload-state", () => {
  let GET: () => Promise<Response>;
  let POST: (req: Request) => Promise<Response>;
  let DELETE: () => Promise<Response>;

  beforeEach(async () => {
    setAuthUnauthenticated();

    // Dynamic import to pick up Clerk mocks (vi.mock is hoisted)
    const mod = await import("@/app/api/upload-state/route");
    GET = mod.GET;
    POST = mod.POST;
    DELETE = mod.DELETE;
  });

  // ── Auth guards ──────────────────────────────────────────────────────────

  describe("authentication", () => {
    it("GET returns 401 when unauthenticated", async () => {
      setAuthUnauthenticated();
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("POST returns 401 when unauthenticated", async () => {
      setAuthUnauthenticated();
      const req = new Request("http://localhost/api/upload-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleState),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("DELETE returns 401 when unauthenticated", async () => {
      setAuthUnauthenticated();
      const res = await DELETE();
      expect(res.status).toBe(401);
    });

    it("GET succeeds when authenticated as admin", async () => {
      setAuthAdmin();
      const res = await GET();
      expect(res.status).toBe(200);
    });

    it("GET succeeds when authenticated as faculty", async () => {
      setAuthFaculty();
      const res = await GET();
      expect(res.status).toBe(200);
    });
  });

  // ── GET — load state ─────────────────────────────────────────────────────

  describe("GET", () => {
    it("returns { state: null } when no state exists in Redis", async () => {
      setAuthAdmin();
      // Default mock: redis.get returns null
      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.state).toBeNull();
    });

    it("returns persisted state when it exists in Redis", async () => {
      setAuthAdmin();
      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(sampleState));

      const res = await GET();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.state).toBeDefined();
      expect(body.state.fileName).toBe("grades.xlsx");
      expect(body.state.academicYear).toBe("AY_2025_2026");
    });
  });

  // ── POST — save state ────────────────────────────────────────────────────

  describe("POST", () => {
    it("saves state and returns it with 24h TTL", async () => {
      setAuthAdmin();
      vi.mocked(redis.get).mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/upload-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleState),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.state.fileName).toBe("grades.xlsx");

      // Verify redis.set was called with TTL
      expect(redis.set).toHaveBeenCalled();
      const setCall = vi.mocked(redis.set).mock.calls[0];
      expect(setCall[2]).toBe("EX");
      expect(setCall[3]).toBe(86400); // 24 hours
    });

    it("merges with existing state (partial update)", async () => {
      setAuthAdmin();
      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(sampleState));

      const partialUpdate = { progress: 50, processedCount: 25 };
      const req = new Request("http://localhost/api/upload-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partialUpdate),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      // Existing values preserved
      expect(body.state.fileName).toBe("grades.xlsx");
      expect(body.state.academicYear).toBe("AY_2025_2026");
      // New values merged in
      expect(body.state.progress).toBe(50);
      expect(body.state.processedCount).toBe(25);
    });

    it("returns 400 for invalid body (wrong type)", async () => {
      setAuthAdmin();
      const req = new Request("http://localhost/api/upload-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYear: 123 }), // should be string
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for non-JSON body", async () => {
      setAuthAdmin();
      const req = new Request("http://localhost/api/upload-state", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // ── DELETE — clear state ─────────────────────────────────────────────────

  describe("DELETE", () => {
    it("deletes state and returns success", async () => {
      setAuthAdmin();
      const res = await DELETE();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(redis.del).toHaveBeenCalled();
    });
  });

  // ── Round-trip: POST → GET → DELETE → GET ────────────────────────────────

  describe("round-trip", () => {
    it("persists, retrieves, and clears state correctly", async () => {
      setAuthAdmin();

      // 1) POST — save state
      vi.mocked(redis.get).mockResolvedValueOnce(null);
      const postReq = new Request("http://localhost/api/upload-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleState),
      });
      const postRes = await POST(postReq);
      expect(postRes.status).toBe(200);

      // 2) GET — retrieve state
      vi.mocked(redis.get).mockResolvedValueOnce(
        JSON.stringify({ ...sampleState, timestamp: Date.now() })
      );
      const getRes = await GET();
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.state.fileName).toBe("grades.xlsx");

      // 3) DELETE — clear state
      const delRes = await DELETE();
      expect(delRes.status).toBe(200);
      expect(redis.del).toHaveBeenCalled();

      // 4) GET — should be null after delete
      vi.mocked(redis.get).mockResolvedValueOnce(null);
      const finalGet = await GET();
      const finalBody = await finalGet.json();
      expect(finalBody.state).toBeNull();
    });
  });
});
