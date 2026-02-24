export const centsToCurrency = (amountCents: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amountCents / 100
  );
};
