export const SeatStatus = {
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
} as const;

export type SeatStatus = (typeof SeatStatus)[keyof typeof SeatStatus];

export const PaymentStatus = {
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
