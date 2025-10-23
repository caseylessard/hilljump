import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { UNIVERSE, TEST_TICKERS } from '@/lib/constants';
import type { ScannerConfig } from '@/types/scanner';

interface ScannerControlsProps {
  config: ScannerConfig;
  onConfigChange: (config: ScannerConfig) => void;
  onScan: (testMode: boolean) => void;
  onClearCache: () => void;
  isScanning: boolean;
}

export function ScannerControls({
  config,
  onConfigChange,
  onScan,
  onClearCache,
  isScanning,
}: ScannerControlsProps) {
  const updateConfig = (key: keyof ScannerConfig, value: number) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* Compact Controls - One line on desktop */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <span className="text-xs text-muted-foreground hidden md:inline">Conv:</span>
          <span className="text-xs text-muted-foreground md:hidden">Min Conv:</span>
          <Select
            value={config.minConviction.toString()}
            onValueChange={(value) => updateConfig('minConviction', parseInt(value))}
            disabled={isScanning}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="60">60%+</SelectItem>
              <SelectItem value="65">65%+</SelectItem>
              <SelectItem value="70">70%+</SelectItem>
              <SelectItem value="75">75%+</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground hidden md:inline ml-2">Signals:</span>
          <span className="text-xs text-muted-foreground md:hidden ml-2">Max:</span>
          <Select
            value={config.maxSignals.toString()}
            onValueChange={(value) => updateConfig('maxSignals', parseInt(value))}
            disabled={isScanning}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="7">7</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="9999">All</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground ml-2">Cache:</span>
          <Select
            value={config.cacheDuration.toString()}
            onValueChange={(value) => updateConfig('cacheDuration', parseInt(value))}
            disabled={isScanning}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Off</SelectItem>
              <SelectItem value="3600">1hr</SelectItem>
              <SelectItem value="14400">4hr</SelectItem>
              <SelectItem value="86400">24hr</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => onScan(true)}
            disabled={isScanning}
            variant="secondary"
            size="sm"
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          >
            🧪 Test ({TEST_TICKERS.length})
          </Button>
          
          <Button
            onClick={() => onScan(false)}
            disabled={isScanning}
            size="sm"
            className="bg-gradient-to-r from-primary to-primary/80"
          >
            🚀 Full Scan ({UNIVERSE.length})
          </Button>
          
          <Button
            onClick={onClearCache}
            disabled={isScanning}
            variant="destructive"
            size="sm"
          >
            🗑️ Clear Cache
          </Button>
        </div>
      </div>
    </div>
  );
}
