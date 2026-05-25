"use server";

import { revalidatePath } from "next/cache";

import { getUserId } from "@/features/auth/session";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { err, type Result } from "@/lib/result";

import {
  completePaymentAndReserve,
  type CompletePaymentError,
  type CompletePaymentSuccess,
} from "./complete-payment";
import { createPaymentIntent, type CreatePaymentError } from "./create-payment-intent";
import { completePaymentSchema, createPaymentSchema } from "./schemas";

type AuthError = "unauthorized" | "invalid_input";

export type CreatePaymentActionResult = Result<
  { paymentId: string },
  CreatePaymentError | AuthError
>;

export async function createPaymentAction(
  raw: unknown,
): Promise<CreatePaymentActionResult> {
  const userId = await getUserId();
  if (!userId) {
    return err("unauthorized", "Sign in to start a payment.");
  }

  const parsed = createPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return err("invalid_input", "Invalid payment request.");
  }

  const result = await createPaymentIntent({
    prisma,
    seatId: parsed.data.seatId,
    userId,
  });

  if (!result.ok) {
    logger.info("create_payment_failed", {
      userId,
      seatId: parsed.data.seatId,
      code: result.code,
    });
    revalidatePath("/");
    return result;
  }

  logger.info("create_payment_ok", {
    userId,
    seatId: parsed.data.seatId,
    paymentId: result.value.paymentId,
  });
  return result;
}

export type CompletePaymentActionResult = Result<
  CompletePaymentSuccess,
  CompletePaymentError | AuthError
>;

export async function completePaymentAction(
  paymentId: string,
  raw: unknown,
): Promise<CompletePaymentActionResult> {
  const userId = await getUserId();
  if (!userId) {
    return err("unauthorized", "Sign in to complete this payment.");
  }

  const parsed = completePaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return err("invalid_input", "Invalid completion request.");
  }

  const result = await completePaymentAndReserve({
    prisma,
    paymentId,
    userId,
    gatewayEventId: `mock:${paymentId}:${parsed.data.outcome}`,
    gatewayStatus: parsed.data.outcome === "success" ? "succeeded" : "failed",
    failureReason:
      parsed.data.outcome === "failure"
        ? "Mock gateway declined the payment."
        : undefined,
    source: "mock_gateway",
  });

  logger.info("complete_payment", {
    userId,
    paymentId,
    outcome: parsed.data.outcome,
    ok: result.ok,
    code: result.ok ? result.value.kind : result.code,
  });

  revalidatePath("/");
  revalidatePath(`/payment/${paymentId}`);
  return result;
}
