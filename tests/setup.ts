import { afterAll, beforeAll, vi } from "vitest";
import * as clerkMocks from "./__mocks__/clerk";

const {
  auth,
  currentUser,
  clerkClient,
  setAuthUnauthenticated,
} = clerkMocks;

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => auth()),
  currentUser: vi.fn(() => currentUser()),
  clerkClient: clerkClient,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    student: {
      findUnique: vi.fn().mockResolvedValue({ isApproved: true, studentNumber: "123" }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    admin: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    grade: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    announcement: {
      findUnique: vi.fn().mockResolvedValue({ id: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({ id: 1 }),
      delete: vi.fn().mockResolvedValue({ id: 1 }),
    },
    event: {
      findUnique: vi.fn().mockResolvedValue({ id: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({ id: 1 }),
      delete: vi.fn().mockResolvedValue({ id: 1 }),
    },
    news: {
      findUnique: vi.fn().mockResolvedValue({ id: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({ id: 1 }),
      delete: vi.fn().mockResolvedValue({ id: 1 }),
    },
    academicTerm: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({}),
    },
    curriculumChecklist: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    subjectOffering: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      $transaction: vi.fn().mockResolvedValue([[], 0]),
    },
    gradeLog: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    pendingGradeChange: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    systemSettings: {
      findUnique: vi.fn().mockResolvedValue({ value: "true" }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    rateLimit: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
    },
    courseAccessSchedule: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    creditedSubject: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn().mockResolvedValue([]),
    $disconnect: vi.fn(),
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    connect: vi.fn().mockResolvedValue(undefined),
    status: "ready",
    on: vi.fn(),
  },
  isRedisConnected: vi.fn(() => true),
  withRedisFallback: vi.fn((fn) => fn()),
}));

vi.mock("xlsx", () => ({
  read: vi.fn(() => ({
    SheetNames: ["Sheet1"],
    Sheets: { Sheet1: {} },
  })),
  utils: {
    sheet_to_json: vi.fn(() => []),
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  write: vi.fn(() => new Uint8Array()),
}));

vi.mock("fast-fuzzy", () => ({
  fuzzy: vi.fn(() => 1),
}));

import { rateLimiterConsume } from "./__mocks__/rate-limiter";

vi.mock("rate-limiter-flexible", () => {
  class MockRateLimiterMemory {
    consume = rateLimiterConsume;
  }
  class MockRateLimiterRedis {
    consume = rateLimiterConsume;
  }
  return {
    RateLimiterMemory: MockRateLimiterMemory,
    RateLimiterRedis: MockRateLimiterRedis,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("ioredis", () => ({
  default: class {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue("OK");
    del = vi.fn().mockResolvedValue(1);
    connect = vi.fn().mockResolvedValue(undefined);
    status = "ready";
    on = vi.fn();
  },
}));

vi.mock("@/lib/rate-limit-postgres", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rate-limit-redis", () => ({
  checkRateLimitRedis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue({}),
  })),
}));

beforeAll(() => {
  setAuthUnauthenticated();
});

afterAll(() => {
  setAuthUnauthenticated();
});
