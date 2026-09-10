export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', name: 'USD ($) - US Dollar' },
  { code: 'EUR', symbol: '€', name: 'EUR (€) - Euro' },
  { code: 'GBP', symbol: '£', name: 'GBP (£) - British Pound' },
  { code: 'INR', symbol: '₹', name: 'INR (₹) - Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'JPY (¥) - Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', name: 'CAD (CA$) - Canadian Dollar' },
  { code: 'AUD', symbol: 'AU$', name: 'AUD (AU$) - Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'CHF (CHF) - Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'CNY (¥) - Chinese Yuan' },
  { code: 'SGD', symbol: 'SG$', name: 'SGD (SG$) - Singapore Dollar' },
  { code: 'AED', symbol: 'AED', name: 'AED (AED) - UAE Dirham' },
];

export function getCurrencySymbol(code?: string): string {
  if (!code) return '$';
  const found = CURRENCIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
  return found ? found.symbol : code;
}

export function formatCurrencyAmount(amount: number, code: string = 'USD'): string {
  const symbol = getCurrencySymbol(code);
  const formattedNumber = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formattedNumber}`;
}
