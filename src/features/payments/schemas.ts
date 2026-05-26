import { z } from "zod";

export const createPaymentSchema = z.object({
  seatId: z.string().min(1, "seatId is required"),
  idempotencyKey: z.string().uuid("idempotencyKey must be a UUID"),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const completePaymentSchema = z.object({
  outcome: z.enum(["success", "failure"]),
});

export type CompletePaymentInput = z.infer<typeof completePaymentSchema>;
