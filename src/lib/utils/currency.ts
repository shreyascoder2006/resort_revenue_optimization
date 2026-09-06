export type Currency = "INR" | "USD";

export interface CurrencyConfig {
  symbol: string;
  code: Currency;
  name: string;
  baseRates: Record<string, number>;
}

export const CURRENCY_CONFIGS: Record<Currency, CurrencyConfig> = {
  INR: {
    symbol: "₹",
    code: "INR",
    name: "Indian Rupee",
    baseRates: {
      standard: 5800,
      "deluxe-ocean": 8200, // Under High demand (1.12x), calculates to exactly ₹9,200!
      "family-suite": 11000,
      "garden-bungalow": 9800,
      "presidential-villa": 28000,
    },
  },
  USD: {
    symbol: "$",
    code: "USD",
    name: "US Dollar",
    baseRates: {
      standard: 180,
      "deluxe-ocean": 260,
      "family-suite": 340,
      "garden-bungalow": 300,
      "presidential-villa": 850,
    },
  },
};

export function formatCurrency(amount: number, currency: Currency = "INR"): string {
  const config = CURRENCY_CONFIGS[currency] ?? CURRENCY_CONFIGS.INR;
  if (currency === "INR") {
    return `${config.symbol}${Math.round(amount).toLocaleString("en-IN")}`;
  }
  return `${config.symbol}${Math.round(amount).toLocaleString()}`;
}
