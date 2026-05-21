export const SeatStatus = {
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
} as const;

export type SeatStatus = (typeof SeatStatus)[keyof typeof SeatStatus];

export function isSeatStatus(value: string): value is SeatStatus {
  return value === SeatStatus.AVAILABLE || value === SeatStatus.RESERVED;
}

export const PaymentStatus = {
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (
    value === PaymentStatus.PENDING ||
    value === PaymentStatus.SUCCEEDED ||
    value === PaymentStatus.FAILED
  );
}
