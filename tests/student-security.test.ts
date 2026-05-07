import { describe, it, expect, beforeEach } from "vitest";
import {
  setAuthUnauthenticated,
  setAuthAdmin,
  setAuthSuperuser,
  setAuthStudent,
  setAuthFaculty,
} from "../tests/__mocks__/clerk";
import { createMockRequest } from "./helpers";

// -----------------------------------------------------------------------------
// Server Action — getStudents (blocks students)
// -----------------------------------------------------------------------------

describe("getStudents — Role guard", () => {
  let getStudents: () => Promise<any>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/actions/student/student");
    getStudents = mod.getStudents;
  });

  it("throws when unauthenticated", async () => {
    setAuthUnauthenticated();
    await expect(getStudents()).rejects.toThrow("Unauthorized");
  });

  it("throws when authenticated as student", async () => {
    setAuthStudent();
    await expect(getStudents()).rejects.toThrow("Forbidden");
  });

  it("allows admin to get students", async () => {
    setAuthAdmin();
    const result = await getStudents();
    expect(result.error).toBeNull();
    expect(result.students).toBeDefined();
  });

  it("allows superuser to get students", async () => {
    setAuthSuperuser();
    const result = await getStudents();
    expect(result.error).toBeNull();
    expect(result.students).toBeDefined();
  });

  it("allows faculty to get students", async () => {
    setAuthFaculty();
    const result = await getStudents();
    expect(result.error).toBeNull();
    expect(result.students).toBeDefined();
  });
});

// -----------------------------------------------------------------------------
// Server Action — getStudentById (IDOR fix)
// -----------------------------------------------------------------------------

describe("getStudentById — IDOR guard", () => {
  let getStudentById: (id: string) => Promise<any>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/actions/student/student");
    getStudentById = mod.getStudentById;
  });

  it("returns error when unauthenticated", async () => {
    setAuthUnauthenticated();
    const result = await getStudentById("student-123");
    expect(result.student).toBeNull();
    expect(result.error).toBe("Unauthorized");
  });

  it("allows student to view their own profile", async () => {
    setAuthStudent();
    const result = await getStudentById("student-123");
    expect(result.error).toBeNull();
  });

  it("denies student from viewing another student", async () => {
    setAuthStudent();
    const result = await getStudentById("different-student-id");
    expect(result.student).toBeNull();
    expect(result.error).toContain("Unauthorized");
  });

  it("allows admin to view any student", async () => {
    setAuthAdmin();
    const result = await getStudentById("any-student-id");
    expect(result.error).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Server Action — createStudent (admin-only)
// -----------------------------------------------------------------------------

describe("createStudent — Role guard", () => {
  let createStudent: (...args: any[]) => Promise<any>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/actions/student/student");
    createStudent = mod.createStudent;
  });

  const studentData = {
    studentNumber: "202400001",
    username: "202400001johndoe",
    firstName: "John",
    lastName: "Doe",
    middleInit: "D",
    email: "john@test.com",
    phone: "09123456789",
    address: "123 Main St",
    sex: "MALE" as const,
    course: "BSIT" as const,
    major: "NONE" as const,
    status: "REGULAR" as const,
    password: "P@ssw0rd123!",
    confirmPassword: "P@ssw0rd123!",
  };

  it("returns error when unauthenticated", async () => {
    setAuthUnauthenticated();
    const result = await createStudent(studentData);
    expect(result.student).toBeNull();
    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when authenticated as student", async () => {
    setAuthStudent();
    const result = await createStudent(studentData);
    expect(result.student).toBeNull();
    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when authenticated as faculty", async () => {
    setAuthFaculty();
    const result = await createStudent(studentData);
    expect(result.student).toBeNull();
    expect(result.error).toBe("Unauthorized");
  });

  it("allows admin to create student", async () => {
    setAuthAdmin();
    const result = await createStudent(studentData);
    expect(result.error).not.toBe("Unauthorized");
  });
});

// -----------------------------------------------------------------------------
// Server Action — updateStudent (admin-only)
// -----------------------------------------------------------------------------

describe("updateStudent — Role guard", () => {
  let updateStudent: (data: any) => Promise<any>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/actions/student/student");
    updateStudent = mod.updateStudent;
  });

  it("returns error when unauthenticated", async () => {
    setAuthUnauthenticated();
    const result = await updateStudent({ id: "student-123" });
    expect(result.student).toBeNull();
    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when authenticated as student", async () => {
    setAuthStudent();
    const result = await updateStudent({ id: "student-123" });
    expect(result.student).toBeNull();
    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when authenticated as faculty", async () => {
    setAuthFaculty();
    const result = await updateStudent({ id: "student-123" });
    expect(result.student).toBeNull();
    expect(result.error).toBe("Unauthorized");
  });

  it("denies with invalid data even for admin", async () => {
    setAuthAdmin();
    const result = await updateStudent({});
    expect(result.error).toBe("Validation failed");
  });
});

// -----------------------------------------------------------------------------
// API Route — GET /api/students/get-student (blocks students)
// -----------------------------------------------------------------------------

describe("GET /api/students/get-student — Role guard", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    setAuthUnauthenticated();
    const mod = await import("@/app/api/students/get-student/route");
    GET = mod.GET;
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthUnauthenticated();
    const req = createMockRequest("GET", "http://localhost/api/students/get-student?query=jane");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated as student", async () => {
    setAuthStudent();
    const req = createMockRequest("GET", "http://localhost/api/students/get-student?query=jane");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("allows admin to search students", async () => {
    setAuthAdmin();
    const req = createMockRequest("GET", "http://localhost/api/students/get-student?query=jane");
    const res = await GET(req);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("allows faculty to search students", async () => {
    setAuthFaculty();
    const req = createMockRequest("GET", "http://localhost/api/students/get-student?query=jane");
    const res = await GET(req);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
