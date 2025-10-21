import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QuantEngine } from "@/lib/quantEngine";
import { ScannerCache } from "@/lib/scannerCache";
import { UNIVERSE, TEST_TICKERS } from "@/lib/constants";
import type { ScannerConfig, ScanProgress, ScanResult, TradingSignal, EODHDData } from "@/types/scanner";

export function useScanner() {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  // Load saved scan result on mount
  useEffect(() => {
    const savedResult = ScannerCache.getScanResult();
    if (savedResult) {
      setResult(savedResult);
    }
  }, []);

  /**
   * Fetch EODHD data for a ticker via edge function
   */
  const fetchEODHD = useCallback(async (ticker: string): Promise<EODHDData | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-eodhd-data", {
        body: { ticker },
      });

      if (error) {
        console.error(`EODHD error for ${ticker}:`, error);
        return null;
      }

      return data as EODHDData;
    } catch (error) {
      console.error(`Fetch error for ${ticker}:`, error);
      return null;
    }
  }, []);

  /**
   * Analyze a single stock
   */
  const analyzeStock = useCallback(
    async (ticker: string, spyData: EODHDData, config: ScannerConfig): Promise<TradingSignal | null> => {
      // Check cache first
      if (config.cacheDuration > 0) {
        const cached = ScannerCache.get(ticker);
        if (cached) return cached;
      }

      // Fetch fresh data
      const tickerData = await fetchEODHD(ticker);
      if (!tickerData) return null;

      // Calculate metrics
      const metrics = QuantEngine.calculateMetrics(tickerData, spyData);

      // Generate signal
      const signal = QuantEngine.calculateSignal(metrics);

      // Cache if valid
      if (signal && config.cacheDuration > 0) {
        ScannerCache.set(ticker, signal, config.cacheDuration);
      }

      return signal;
    },
    [fetchEODHD],
  );

  /**
   * Run a full scan
   */
  const runScan = useCallback(
    async (config: ScannerConfig, testMode: boolean = false) => {
      setIsScanning(true);
      setResult(null);

      const tickersToScan = testMode ? TEST_TICKERS : UNIVERSE;
      const signals: TradingSignal[] = [];

      try {
        // Fetch SPY data once
        toast({
          title: "Fetching market benchmark...",
          description: "Loading SPY data for relative strength calculations",
        });

        const spyData = await fetchEODHD("SPY");

        if (!spyData) {
          throw new Error("Failed to fetch SPY data");
        }

        // Scan each ticker
        for (let i = 0; i < tickersToScan.length; i++) {
          const ticker = tickersToScan[i];

          setProgress({
            current: i + 1,
            total: tickersToScan.length,
            ticker,
          });

          try {
            const signal = await analyzeStock(ticker, spyData, config);

            if (signal && signal.conviction >= config.minConviction) {
              signals.push(signal);
            }
          } catch (error) {
            console.error(`Error analyzing ${ticker}:`, error);
          }

          // Small delay to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // Sort by conviction and take top N
        signals.sort((a, b) => b.conviction - a.conviction);
        const topSignals = signals.slice(0, config.maxSignals);

        // ============================================
        // ⭐ BATCH EARNINGS ENRICHMENT (1 API call!)
        // ============================================
        toast({
          title: "Enriching with earnings data...",
          description: "Fetching all earnings in one optimized call",
        });

        let enrichedSignals = topSignals;

        try {
          console.log(`📊 Batch enriching ${topSignals.length} signals...`);

          // ONE function call for ALL signals
          enrichedSignals = await QuantEngine.batchEnrichWithEarnings(topSignals, supabase);

          console.log("✅ Successfully enriched signals with earnings data");

          toast({
            title: "✅ Earnings data added",
            description: `Enriched ${enrichedSignals.length} signals`,
          });
        } catch (error) {
          console.error("❌ Error enriching signals:", error);
          toast({
            title: "⚠️ Enrichment failed",
            description: "Using signals without earnings data",
            variant: "destructive",
          });
          enrichedSignals = topSignals;
        }

        // Re-sort after enrichment (conviction may have changed)
        enrichedSignals.sort((a, b) => b.conviction - a.conviction);

        // ============================================
        // Calculate stats (using enriched signals)
        // ============================================
        const scanResult: ScanResult = {
          signals: enrichedSignals,
          totalAnalyzed: tickersToScan.length,
          qualifiedSignals: signals.length,
          avgConviction:
            enrichedSignals.length > 0
              ? Math.round(enrichedSignals.reduce((sum, s) => sum + s.conviction, 0) / enrichedSignals.length)
              : 0,
          avgRR:
            enrichedSignals.length > 0
              ? Number((enrichedSignals.reduce((sum, s) => sum + s.rr, 0) / enrichedSignals.length).toFixed(1))
              : 0,
          analyzedTickers: tickersToScan,
        };

        setResult(scanResult);

        // Save to localStorage for persistence
        ScannerCache.saveScanResult(scanResult);

        toast({
          title: "Scan complete!",
          description: `Found ${enrichedSignals.length} high-conviction signals`,
        });

        // Post results to community feed (fire and forget)
        if (!testMode) {
          supabase.functions
            .invoke("post-scan-results", {
              body: { scanResults: scanResult },
            })
            .then(({ error }) => {
              if (error) {
                console.error("Failed to post scan results:", error);
              } else {
                console.log("✅ Posted scan results to community feed");
              }
            });
        }
      } catch (error) {
        console.error("Scan error:", error);
        toast({
          title: "Scan failed",
          description: error instanceof Error ? error.message : "Unknown error occurred",
          variant: "destructive",
        });
      } finally {
        setIsScanning(false);
        setProgress(null);
      }
    },
    [analyzeStock, fetchEODHD, toast],
  );

  /**
   * Clear cache
   */
  const clearCache = useCallback(() => {
    const count = ScannerCache.clear();
    ScannerCache.clearScanResult();
    setResult(null);
    toast({
      title: "Cache cleared",
      description: `Removed ${count} cached stocks and scan results`,
    });
  }, [toast]);

  return {
    isScanning,
    progress,
    result,
    runScan,
    clearCache,
  };
}
