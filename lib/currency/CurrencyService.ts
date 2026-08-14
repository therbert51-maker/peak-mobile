/**
 * Live FX conversion is a future branch — do not fabricate rates here.
 */
export interface CurrencyService {
  /** Returns converted amount or null when conversion is unavailable. */
  convert(amount: number, fromCurrency: string, toCurrency: string): Promise<number | null>;
}

export class PlaceholderCurrencyService implements CurrencyService {
  async convert(
    _amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number | null> {
    if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
      return _amount;
    }
    return null;
  }
}

export const currencyService: CurrencyService = new PlaceholderCurrencyService();
