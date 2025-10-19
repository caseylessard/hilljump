import type { TradingSignal, CachedSignal } from '@/types/scanner';
import { CACHE_KEY_PREFIX } from './constants';

export class ScannerCache {
  /**
   * Get cached signal for ticker
   */
  static get(ticker: string): TradingSignal | null {
    try {
      const key = `${CACHE_KEY_PREFIX}${ticker}`;
      const data = localStorage.getItem(key);
      
      if (!data) return null;

      const cached: CachedSignal = JSON.parse(data);
      
      if (Date.now() > cached.expiry) {
        localStorage.removeItem(key);
        return null;
      }

      // Rehydrate Date object
      cached.signal.exitDate = new Date(cached.signal.exitDate);
      return cached.signal;
    } catch (error) {
      console.error(`Cache get error for ${ticker}:`, error);
      return null;
    }
  }

  /**
   * Set cached signal for ticker
   */
  static set(ticker: string, signal: TradingSignal, durationSeconds: number): void {
    try {
      const key = `${CACHE_KEY_PREFIX}${ticker}`;
      const expiry = Date.now() + (durationSeconds * 1000);
      
      const cached: CachedSignal = {
        signal,
        expiry
      };
      
      localStorage.setItem(key, JSON.stringify(cached));
    } catch (error) {
      console.error(`Cache set error for ${ticker}:`, error);
    }
  }

  /**
   * Clear all cached signals
   */
  static clear(): number {
    let count = 0;
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
        count++;
      }
    });
    
    return count;
  }

  /**
   * Get cache stats
   */
  static stats(): { total: number; expired: number; valid: number } {
    const keys = Object.keys(localStorage);
    const scannerKeys = keys.filter(k => k.startsWith(CACHE_KEY_PREFIX));
    
    let expired = 0;
    let valid = 0;
    
    scannerKeys.forEach(key => {
      try {
        const data = localStorage.getItem(key);
        if (!data) return;
        
        const cached: CachedSignal = JSON.parse(data);
        
        if (Date.now() > cached.expiry) {
          expired++;
        } else {
          valid++;
        }
      } catch {
        expired++;
      }
    });
    
    return {
      total: scannerKeys.length,
      expired,
      valid
    };
  }
}
