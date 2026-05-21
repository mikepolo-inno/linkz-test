type FormatMoneyOptions = {
  amountCents: number;
  currency: string;
  locale?: string;
};

export function formatMoney({
  amountCents,
  currency,
  locale = "en-US",
}: FormatMoneyOptions): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}
