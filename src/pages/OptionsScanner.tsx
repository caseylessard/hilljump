import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useScanner } from "@/hooks/useScanner";
import { ScannerControls } from "@/components/scanner/ScannerControls";
import { ScannerStats } from "@/components/scanner/ScannerStats";
import { ProgressBar } from "@/components/scanner/ProgressBar";
import { SignalCard } from "@/components/scanner/SignalCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DEFAULT_CONFIG } from "@/lib/constants";
import Navigation from "@/components/Navigation";
import type { ScannerConfig } from "@/types/scanner";

export default function OptionsScanner() {
  const [config, setConfig] = useState<ScannerConfig>(DEFAULT_CONFIG);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const navigate = useNavigate();

  const { isScanning, progress, result, runScan, clearCache } = useScanner();

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate("/auth");
        return;
      }

      setIsAuthenticated(true);
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        navigate("/auth");
      } else {
        setIsAuthenticated(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Show nothing while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const handleScan = (testMode: boolean) => {
    runScan(config, testMode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <Navigation />
      <div className="container py-4 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Quantitative Options Scanner</h1>
          <p className="text-muted-foreground">Advanced momentum and relative strength analysis for options trading</p>
        </div>

        {/* Controls */}
        <ScannerControls
          config={config}
          onConfigChange={setConfig}
          onScan={handleScan}
          onClearCache={clearCache}
          isScanning={isScanning}
        />

        {/* API Info Alert */}
        <Alert className="mb-6 bg-primary/5 border-primary/20">
          <AlertDescription className="text-sm">
            <strong>📡 Data Source:</strong> Using EODHD for 365-day historical data. Metrics include 50-day z-scores,
            ATR-based risk management, and relative strength vs SPY. All API calls are securely processed through
            backend functions.
          </AlertDescription>
        </Alert>

        {/* Progress Bar */}
        {isScanning && progress && (
          <ProgressBar current={progress.current} total={progress.total} ticker={progress.ticker} />
        )}

        {/* Stats */}
        {result && !isScanning && (
          <ScannerStats
            totalAnalyzed={result.totalAnalyzed}
            qualifiedSignals={result.qualifiedSignals}
            avgConviction={result.avgConviction}
            avgRR={result.avgRR}
          />
        )}

        {/* Signals */}
        {result && result.signals.length > 0 && !isScanning && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-primary uppercase tracking-wide">Top Signals</h2>
            <div className="space-y-4">
              {result.signals.map((signal, index) => (
                <SignalCard key={`${signal.ticker}-${index}`} signal={signal} rank={index + 1} />
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {result && result.signals.length === 0 && !isScanning && (
          <Alert className="bg-muted/30">
            <AlertDescription>
              No signals found matching your criteria. Try lowering the conviction threshold.
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isScanning && !progress && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="animate-pulse">Initializing scan...</div>
          </div>
        )}
      </div>
    </div>
  );
  // After generating signals
  const enrichedSignals = await Promise.all(
    signals.map((signal) => QuantEngine.enrichWithEarnings(signal, EODHD_API_KEY)),
  );
}
