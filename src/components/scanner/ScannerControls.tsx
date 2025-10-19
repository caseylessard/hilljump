import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
    <div className="bg-card border border-border rounded-lg p-6 mb-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Min Conviction */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Min Conviction
          </Label>
          <Select
            value={config.minConviction.toString()}
            onValueChange={(value) => updateConfig('minConviction', parseInt(value))}
            disabled={isScanning}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="60">60%+</SelectItem>
              <SelectItem value="65">65%+</SelectItem>
              <SelectItem value="70">70%+</SelectItem>
              <SelectItem value="75">75%+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Max Signals */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Max Signals
          </Label>
          <Select
            value={config.maxSignals.toString()}
            onValueChange={(value) => updateConfig('maxSignals', parseInt(value))}
            disabled={isScanning}
          >
            <SelectTrigger>
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
        </div>

        {/* Cache Duration */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Cache
          </Label>
          <Select
            value={config.cacheDuration.toString()}
            onValueChange={(value) => updateConfig('cacheDuration', parseInt(value))}
            disabled={isScanning}
          >
            <SelectTrigger>
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
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-2">
        <Button
          onClick={() => onScan(true)}
          disabled={isScanning}
          variant="secondary"
          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
        >
          🧪 Test (5)
        </Button>
        
        <Button
          onClick={() => onScan(false)}
          disabled={isScanning}
          className="bg-gradient-to-r from-primary to-primary/80"
        >
          🚀 Full Scan (84)
        </Button>
        
        <Button
          onClick={onClearCache}
          disabled={isScanning}
          variant="destructive"
          className="ml-auto"
        >
          🗑️ Clear Cache
        </Button>
      </div>
    </div>
  );
}
