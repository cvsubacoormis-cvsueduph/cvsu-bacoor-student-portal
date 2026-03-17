import { z } from "zod";

export const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be less than 50 characters"),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  middleInit: z.string().max(1, "Middle initial can only be 1 character").optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().min(7, "Phone number is too short").max(20).optional().or(z.literal("")),
  address: z.string().min(5, "Address must be at least 5 characters"),
  sex: z.enum(["MALE", "FEMALE"], { required_error: "Sex is required" }),
  role: z.enum(["faculty", "registrar"], { required_error: "Role is required" }),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const bulkUserSchema = z.array(createUserSchema);
