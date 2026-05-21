export interface PriceChangeResult {
    changed: boolean;
    delta: number;          // positive = price went up, negative = went down
    percentChange: number;
  }
  
  export function detectPriceChange(
    oldPrice: number,
    newPrice: number,
  ): PriceChangeResult {
    const changed = oldPrice !== newPrice;
    const delta = newPrice - oldPrice;
    const percentChange = oldPrice > 0
      ? Math.round((delta / oldPrice) * 10000) / 100  // 2 decimal places
      : 0;
  
    return { changed, delta, percentChange };
  }