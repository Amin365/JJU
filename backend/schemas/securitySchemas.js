import { z } from "zod";

const idParam = z.object({
  id: z.string().regex(/^\d+$/, "id must be a positive integer"),
});

const issueRequestIdParam = z.object({
  id: z.string().regex(/^\d+$/, "id must be a positive integer"),
});

export const authSchemas = {
  register: z.object({
    username: z.string().trim().min(3).max(64),
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(128),
  }),
  login: z
    .object({
      identifier: z.string().trim().min(3).max(255).optional(),
      email: z.string().trim().email().max(255).optional(),
      username: z.string().trim().min(3).max(255).optional(),
      password: z.string().min(1).max(128),
    })
    .refine((v) => Boolean(v.identifier || v.email || v.username), {
      message: "identifier, email or username is required",
      path: ["identifier"],
    }),
  setupPassword: z.object({
    token: z.string().trim().min(20).max(512),
    password: z.string().min(8).max(128),
  }),
  resendInvite: z.object({
    email: z.string().trim().email().max(255),
  }),
  validateInviteParams: z.object({
    token: z.string().trim().min(20).max(512),
  }),
};

export const userSchemas = {
  forgotPassword: z.object({
    email: z.string().trim().email().max(255),
  }),
  resendResetCode: z.object({
    email: z.string().trim().email().max(255),
  }),
  verifyResetCode: z.object({
    email: z.string().trim().email().max(255),
    code: z.string().trim().regex(/^\d{6}$/, "code must be 6 digits"),
  }),
  resetPassword: z.object({
    userId: z.coerce.number().int().positive(),
    code: z.string().trim().regex(/^\d{6}$/, "code must be 6 digits"),
    newPassword: z.string().min(8).max(128),
  }),
  userIdParams: idParam,
};

export const issueRequestSchemas = {
  create: z.object({
    book: z.coerce.number().int().positive(),
    member: z.coerce.number().int().positive(),
    requestedDays: z.coerce.number().int().min(1).max(30).optional(),
    note: z.string().trim().max(500).optional(),
  }),
  review: z.object({
    reviewNote: z.string().trim().max(500).optional(),
  }),
  convertToIssue: z.object({
    issueDate: z.string().trim().min(8).max(40),
    returnDate: z.string().trim().min(8).max(40),
  }),
  idParams: issueRequestIdParam,
};
