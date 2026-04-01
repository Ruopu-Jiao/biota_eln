import { z } from "zod";

export const signInSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required."),
    lastName: z.string().trim().min(1, "Last name is required."),
    email: z.email().trim().toLowerCase(),
    password: z.string().min(12, "Password must be at least 12 characters."),
    confirmPassword: z.string().min(12, "Please confirm your password."),
    workspaceName: z.string().trim().min(2, "Workspace name is required."),
    terms: z
      .string()
      .optional()
      .transform((value) => value === "on"),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }

    if (!value.terms) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["terms"],
        message: "You must accept the early access terms.",
      });
    }
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
