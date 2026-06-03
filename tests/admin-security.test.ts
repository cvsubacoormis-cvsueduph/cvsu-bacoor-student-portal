import { describe, it, expect, beforeEach } from "vitest";
import {
  setAuthUnauthenticated,
  setAuthAdmin,
  setAuthSuperuser,
  setAuthFaculty,
  setAuthRegistrar,
  setAuthStudent,
} from "../tests/__mocks__/clerk";
import { createMockRequest } from "./helpers";

// -----------------------------------------------------------------------------
// Server Actions — createAdmin
// -----------------------------------------------------------------------------

describe("createAdmin — Role guard", () => {
  let createAdmin: (...args: any[]) => Promise<any>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/actions/admin/admin");
    createAdmin = mod.createAdmin;
  });

  it("returns error when unauthenticated", async () => {
    setAuthUnauthenticated();
    const result = await createAdmin({
      firstName: "Test", middleInit: "T", lastName: "User",
      username: "testuser", password: "P@ssw0rd!", confirmPassword: "P@ssw0rd!",
      email: "test@test.com", address: "123 St", phone: "09123456789",
      birthday: "2000-01-01", sex: "MALE",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when authenticated as student", async () => {
    setAuthStudent();
    const result = await createAdmin({
      firstName: "Test", middleInit: "T", lastName: "User",
      username: "testuser", password: "P@ssw0rd!", confirmPassword: "P@ssw0rd!",
      email: "test@test.com", address: "123 St", phone: "09123456789",
      birthday: "2000-01-01", sex: "MALE",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("superuser");
  });

  it("returns error when authenticated as faculty", async () => {
    setAuthFaculty();
    const result = await createAdmin({
      firstName: "Test", middleInit: "T", lastName: "User",
      username: "testuser", password: "P@ssw0rd!", confirmPassword: "P@ssw0rd!",
      email: "test@test.com", address: "123 St", phone: "09123456789",
      birthday: "2000-01-01", sex: "MALE",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("superuser");
  });

  it("returns error when authenticated as registrar", async () => {
    setAuthRegistrar();
    const result = await createAdmin({
      firstName: "Test", middleInit: "T", lastName: "User",
      username: "testuser", password: "P@ssw0rd!", confirmPassword: "P@ssw0rd!",
      email: "test@test.com", address: "123 St", phone: "09123456789",
      birthday: "2000-01-01", sex: "MALE",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("superuser");
  });

  it("returns error when authenticated as regular admin", async () => {
    setAuthAdmin();
    const result = await createAdmin({
      firstName: "Test", middleInit: "T", lastName: "User",
      username: "testuser", password: "P@ssw0rd!", confirmPassword: "P@ssw0rd!",
      email: "test@test.com", address: "123 St", phone: "09123456789",
      birthday: "2000-01-01", sex: "MALE",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("superuser");
  });

  it("allows superuser to create admin", async () => {
    setAuthSuperuser();
    const result = await createAdmin({
      firstName: "Test", middleInit: "T", lastName: "User",
      username: "testuser2", password: "P@ssw0rd!", confirmPassword: "P@ssw0rd!",
      email: "test2@test.com", address: "123 St", phone: "09123456789",
      birthday: "2000-01-01", sex: "MALE",
    });
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// Server Actions — updateAdmin
// -----------------------------------------------------------------------------

describe("updateAdmin — Role guard", () => {
  let updateAdmin: (...args: any[]) => Promise<any>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/actions/admin/admin");
    updateAdmin = mod.updateAdmin;
  });

  const updateData = {
    firstName: "Updated", middleInit: "U", lastName: "Name",
    username: "updateduser", email: "up@test.com",
    address: "456 St", phone: "09987654321",
    birthday: "1995-06-15", sex: "MALE" as const,
  };

  it("returns error when unauthenticated", async () => {
    setAuthUnauthenticated();
    const result = await updateAdmin("admin-123", updateData);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when authenticated as student", async () => {
    setAuthStudent();
    const result = await updateAdmin("admin-123", updateData);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Forbidden");
  });

  it("returns error when authenticated as faculty", async () => {
    setAuthFaculty();
    const result = await updateAdmin("admin-123", updateData);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Forbidden");
  });

  it("returns error when authenticated as registrar", async () => {
    setAuthRegistrar();
    const result = await updateAdmin("admin-123", updateData);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Forbidden");
  });

  it("allows admin to update", async () => {
    setAuthAdmin();
    const result = await updateAdmin("admin-123", updateData);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("allows superuser to update", async () => {
    setAuthSuperuser();
    const result = await updateAdmin("admin-123", updateData);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// API Route — POST /api/upload
// -----------------------------------------------------------------------------

describe("POST /api/upload — Role guard", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/upload/route");
    POST = mod.POST;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const req = createMockRequest("POST", "http://localhost/api/upload");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as student", async () => {
    setAuthStudent();
    const req = createMockRequest("POST", "http://localhost/api/upload");
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when authenticated as faculty", async () => {
    setAuthFaculty();
    const req = createMockRequest("POST", "http://localhost/api/upload");
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when authenticated as registrar", async () => {
    setAuthRegistrar();
    const req = createMockRequest("POST", "http://localhost/api/upload");
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("allows admin to upload", async () => {
    setAuthAdmin();
    const req = createMockRequest("POST", "http://localhost/api/upload");
    const res = await POST(req);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("allows superuser to upload", async () => {
    setAuthSuperuser();
    const req = createMockRequest("POST", "http://localhost/api/upload");
    const res = await POST(req);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// -----------------------------------------------------------------------------
// API Route — GET /api/subject-offerings
// -----------------------------------------------------------------------------

describe("GET /api/subject-offerings — Auth guard", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/subject-offerings/route");
    GET = mod.GET;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const url = "http://localhost/api/subject-offerings?academicYear=AY_2024_2025&semester=FIRST";
    const res = await GET(createMockRequest("GET", url));
    expect(res.status).toBe(401);
  });

  it("returns 200 when authenticated as student", async () => {
    setAuthStudent();
    const url = "http://localhost/api/subject-offerings?academicYear=AY_2024_2025&semester=FIRST";
    const res = await GET(createMockRequest("GET", url));
    expect(res.status).toBe(200);
  });

  it("returns 200 when authenticated as admin", async () => {
    setAuthAdmin();
    const url = "http://localhost/api/subject-offerings?academicYear=AY_2024_2025&semester=FIRST";
    const res = await GET(createMockRequest("GET", url));
    expect(res.status).toBe(200);
  });
});

// -----------------------------------------------------------------------------
// API Route — PATCH /api/preview-grades
// -----------------------------------------------------------------------------

describe("PATCH /api/preview-grades — Role guard", () => {
  let PATCH: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/preview-grades/route");
    PATCH = mod.PATCH;
  });

  const gradeBody = {
    courseCode: "CS101",
    creditUnit: 3,
    courseTitle: "Intro to CS",
    grade: "1.00",
    reExam: null,
    remarks: null,
    instructor: "Prof. Test",
  };

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const res = await PATCH(
      createMockRequest("PATCH", "http://localhost/api/preview-grades?id=grade-1", gradeBody)
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as student", async () => {
    setAuthStudent();
    const res = await PATCH(
      createMockRequest("PATCH", "http://localhost/api/preview-grades?id=grade-1", gradeBody)
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when authenticated as faculty", async () => {
    setAuthFaculty();
    const res = await PATCH(
      createMockRequest("PATCH", "http://localhost/api/preview-grades?id=grade-1", gradeBody)
    );
    expect(res.status).toBe(403);
  });

  it("allows registrar to patch grades", async () => {
    setAuthRegistrar();
    const res = await PATCH(
      createMockRequest("PATCH", "http://localhost/api/preview-grades?id=grade-1", gradeBody)
    );
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("allows admin to patch grades", async () => {
    setAuthAdmin();
    const res = await PATCH(
      createMockRequest("PATCH", "http://localhost/api/preview-grades?id=grade-1", gradeBody)
    );
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("allows superuser to patch grades", async () => {
    setAuthSuperuser();
    const res = await PATCH(
      createMockRequest("PATCH", "http://localhost/api/preview-grades?id=grade-1", gradeBody)
    );
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// -----------------------------------------------------------------------------
// API Route — POST /api/preview-grades
// -----------------------------------------------------------------------------

describe("POST /api/preview-grades — Role guard", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/preview-grades/route");
    POST = mod.POST;
  });

  const gradeBody = {
    studentNumber: "123456789",
    academicYear: "AY_2024_2025",
    semester: "FIRST",
    courseCode: "CS101",
    creditUnit: 3,
    courseTitle: "Intro to CS",
    grade: "1.00",
    reExam: null,
    remarks: null,
    instructor: "Prof. Test",
  };

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const res = await POST(
      createMockRequest("POST", "http://localhost/api/preview-grades", gradeBody)
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as student", async () => {
    setAuthStudent();
    const res = await POST(
      createMockRequest("POST", "http://localhost/api/preview-grades", gradeBody)
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when authenticated as faculty", async () => {
    setAuthFaculty();
    const res = await POST(
      createMockRequest("POST", "http://localhost/api/preview-grades", gradeBody)
    );
    expect(res.status).toBe(403);
  });

  it("allows admin to post grades", async () => {
    setAuthAdmin();
    const res = await POST(
      createMockRequest("POST", "http://localhost/api/preview-grades", gradeBody)
    );
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// -----------------------------------------------------------------------------
// API Route — DELETE /api/preview-grades
// -----------------------------------------------------------------------------

describe("DELETE /api/preview-grades — Role guard", () => {
  let DELETE: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/preview-grades/route");
    DELETE = mod.DELETE;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const req = createMockRequest("DELETE", "http://localhost/api/preview-grades?id=grade-1");
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as student", async () => {
    setAuthStudent();
    const req = createMockRequest("DELETE", "http://localhost/api/preview-grades?id=grade-1");
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when authenticated as faculty", async () => {
    setAuthFaculty();
    const req = createMockRequest("DELETE", "http://localhost/api/preview-grades?id=grade-1");
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("allows admin to delete grades", async () => {
    setAuthAdmin();
    const req = createMockRequest("DELETE", "http://localhost/api/preview-grades?id=grade-1");
    const res = await DELETE(req);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
