import { useState } from 'react';
import { useScanner } from '@/hooks/useScanner';
import { ScannerControls } from '@/components/scanner/ScannerControls';
import { ScannerStats } from '@/components/scanner/ScannerStats';
import { ProgressBar } from '@/components/scanner/ProgressBar';
import { SignalCard } from '@/components/scanner/SignalCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DEFAULT_CONFIG } from '@/lib/constants';
import type { ScannerConfig } from '@/types/scanner';

const EODHD_API_KEY = import.meta.env.VITE_EODHD_API_KEY || 'demo';

export default function OptionsScanner() {
  const [config, setConfig] = useState<ScannerConfig>(DEFAULT_CONFIG);
  
  const {
    isScanning,
    progress,
    result,
    runScan,
    clearCache,
  } = useScanner({ eodhd_api_key: EODHD_API_KEY });

  const handleScan = (testMode: boolean) => {
    runScan(config, testMode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8 pb-8 border-b border-border/50">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            ⚡ HILLJUMP CAPITAL
          </h1>
          <p className="text-muted-foreground text-lg">
            Quantitative Options Scanner
          </p>
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
            <strong>📡 Data Source:</strong> Using EODHD for 365-day historical data. 
            Metrics include 50-day z-scores, ATR-based risk management, and relative strength vs SPY.
            {EODHD_API_KEY === 'demo' && (
              <span className="text-destructive ml-2 font-semibold">
                ⚠️ Demo mode - Set VITE_EODHD_API_KEY in .env for full access
              </span>
            )}
          </AlertDescription>
        </Alert>

        {/* Progress Bar */}
        {isScanning && progress && (
          <ProgressBar
            current={progress.current}
            total={progress.total}
            ticker={progress.ticker}
          />
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
            <h2 className="text-2xl font-semibold text-primary uppercase tracking-wide">
              Top Signals
            </h2>
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
}
