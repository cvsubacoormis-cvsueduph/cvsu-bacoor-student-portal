import { vi } from "vitest";

export type MockAuthConfig = {
  userId: string | null;
  role?: string;
};

export type MockUserConfig = {
  id: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
};

let currentAuth: MockAuthConfig = { userId: null };
let currentUserData: MockUserConfig | null = null;

export function setAuth(config: MockAuthConfig) {
  currentAuth = config;
  currentUserData = config.userId
    ? {
        id: config.userId,
        role: config.role,
        firstName: "Test",
        lastName: "User",
        fullName: "Test User",
      }
    : null;
}

export function setAuthUnauthenticated() {
  setAuth({ userId: null });
}

export function setAuthAdmin() {
  setAuth({ userId: "admin-123", role: "admin" });
}

export function setAuthSuperuser() {
  setAuth({ userId: "super-123", role: "superuser" });
}

export function setAuthFaculty() {
  setAuth({ userId: "faculty-123", role: "faculty" });
}

export function setAuthRegistrar() {
  setAuth({ userId: "registrar-123", role: "registrar" });
}

export function setAuthRegistrarStaff() {
  setAuth({ userId: "registrar-staff-123", role: "registrar_staff" });
}

export function setAuthStudent() {
  setAuth({ userId: "student-123", role: "student" });
}

export function auth() {
  if (!currentAuth.userId) {
    return { userId: null, sessionClaims: null };
  }
  return {
    userId: currentAuth.userId,
    sessionClaims: {
      metadata: { role: currentAuth.role },
      publicMetadata: { role: currentAuth.role },
    },
  };
}

export function currentUser() {
  if (!currentUserData) return null;
  return {
    id: currentUserData.id,
    publicMetadata: { role: currentUserData.role },
    firstName: currentUserData.firstName ?? "Test",
    lastName: currentUserData.lastName ?? "User",
    fullName: currentUserData.fullName ?? "Test User",
  };
}

export const clerkClient = vi.fn(() => ({
  users: {
    deleteUser: vi.fn(),
    createUser: vi.fn().mockResolvedValue({ id: "new-user-123" }),
    getUser: vi.fn().mockResolvedValue({
      id: "user-123",
      publicMetadata: { role: "student" },
      firstName: "Test",
      lastName: "User",
      fullName: "Test User",
    }),
    getUserList: vi.fn().mockResolvedValue({ data: [], totalCount: 0 }),
    updateUser: vi.fn(),
    updateUserMetadata: vi.fn(),
  },
}));
