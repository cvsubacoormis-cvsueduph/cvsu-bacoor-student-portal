import { z } from "zod";

const baseStudentSchema = z.object({
  studentNumber: z
    .string()
    .min(1, "Student number is required")
    .max(15, "Max 15 characters")
    .regex(/^[0-9]+$/, "Student number can only contain numbers"),
  username: z
    .string()
    .regex(
      /^[a-zA-Z][a-zA-Z0-9]*$/,
      "Username must start with a letter and can contain letters and numbers"
    )
    .min(1, "Username is required")
    .max(20, "Max 20 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(20, "Max 20 characters"),
  confirmPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(20, "Max 20 characters"),
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(20, "Max 30 characters")
    .regex(/^[a-zA-Z]+$/, "First name can only contain letters"),
  middleInit: z.string().max(10).optional(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(20, "Max 20 characters")
    .regex(/^[a-zA-Z]+$/, "Last name can only contain letters"),
  email: z.string().email("Invalid email format").optional(),
  phone: z.string().min(1, "Phone number is required").max(18).optional(),
  address: z.string().min(1, "Address is required").max(100),
  sex: z.enum(["MALE", "FEMALE"], {
    message: "Sex is required",
  }),
  course: z.enum(["BSIT", "BSCS", "BSBA", "BSHM", "BSP", "BSCRIM", "BSED"], {
    message: "Course is required",
  }),
  major: z
    .enum(
      [
        "HUMAN_RESOURCE_MANAGEMENT",
        "MARKETING_MANAGEMENT",
        "ENGLISH",
        "MATHEMATICS",
        "NONE",
      ],
      {
        message: "Major is required when applicable",
      }
    )
    .optional(),
  status: z.enum(
    ["REGULAR", "IRREGULAR", "NOT_ANNOUNCED", "TRANSFEREE", "RETURNEE"],
    {
      message: "Status is required",
    }
  ),
});

export const createStudentSchema = baseStudentSchema.refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  }
);
export type CreateStudentSchema = z.infer<typeof createStudentSchema>;

// Schema for updating a student (ID required)
export const updateStudentSchema = z.object({
  id: z.string(),
  studentNumber: z
    .string()
    .min(1, "Student number is required")
    .max(15, "Max 15 characters")
    .regex(/^[0-9]+$/, "Student number can only contain numbers"),
  username: z
    .string()
    .regex(
      /^[a-zA-Z][a-zA-Z0-9]*$/,
      "Username must start with a letter and can contain letters and numbers"
    )
    .min(1, "Username is required")
    .max(20, "Max 20 characters"),
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(20, "Max 30 characters")
    .regex(/^[a-zA-Z]+$/, "First name can only contain letters"),
  middleInit: z.string().min(1).max(10).optional(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(20, "Max 20 characters")
    .regex(/^[a-zA-Z]+$/, "Last name can only contain letters"),
  email: z.string().email("Invalid email format").optional(),
  phone: z.string().min(1, "Phone number is required").max(18).optional(),
  address: z.string().min(1, "Address is required").max(100),
  sex: z.enum(["MALE", "FEMALE"], {
    message: "Sex is required",
  }),
  course: z.enum(["BSIT", "BSCS", "BSBA", "BSHM", "BSP", "BSCRIM", "BSED"], {
    message: "Course is required",
  }),
  major: z
    .enum(
      [
        "HUMAN_RESOURCE_MANAGEMENT",
        "MARKETING_MANAGEMENT",
        "ENGLISH",
        "MATHEMATICS",
        "NONE",
      ],
      {
        message: "Major is required when applicable",
      }
    )
    .optional(),
  status: z.enum(
    ["REGULAR", "IRREGULAR", "NOT_ANNOUNCED", "TRANSFEREE", "RETURNEE"],
    {
      message: "Status is required",
    }
  ),
});
export type UpdateStudentSchema = z.infer<typeof updateStudentSchema>;

export const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});

export type EventSchema = z.infer<typeof eventSchema>;

export const announcementSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});

export type AnnouncementSchema = z.infer<typeof announcementSchema>;

export const createAdminSchema = z
  .object({
    firstName: z.string().min(1, "First Name is required"),
    middleInit: z.string().min(1, "Middle Initial is required"),
    lastName: z.string().min(1, "Last Name is required"),
    email: z.string().email("Invalid email format").min(1, "Email is required"),
    address: z.string().min(1, "Address is required"),
    phone: z.string().min(1, "Phone is required"),
    birthday: z.string(),
    sex: z.enum(["MALE", "FEMALE"], {
      message: "Sex is required",
    }),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm Password is required"),
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (password !== confirmPassword) {
      ctx.addIssue({
        path: ["confirmPassword"],
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
      });
    }
  });

export type CreateAdminSchema = z.infer<typeof createAdminSchema>;

export const updateAdminSchema = z.object({
  firstName: z.string().min(1, "First Name is required"),
  middleInit: z.string().min(1, "Middle Initial is required"),
  lastName: z.string().min(1, "Last Name is required"),
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email format").min(1, "Email is required"),
  address: z.string().min(1, "Address is required"),
  phone: z.string().min(1, "Phone is required"),
  birthday: z.string(),
  sex: z.enum(["MALE", "FEMALE"], {
    message: "Sex is required",
  }),
});

export const gradeSchema = z.object({
  studentNumber: z.string(),
  courseCode: z.string(),
  courseTitle: z.string(),
  creditUnit: z.number(),
  grade: z.string(),
  reExam: z.string().optional(),
  remarks: z.string().optional(),
  instructor: z.string(),
  academicYear: z.enum([
    "AY_2023_2024",
    "AY_2024_2025",
    "AY_2025_2026",
    "AY_2026_2027",
  ]),
  semester: z.enum(["FIRST", "SECOND", "MIDYEAR"]),
});

export type GradeSchema = z.infer<typeof gradeSchema>;
