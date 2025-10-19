interface ProgressBarProps {
  current: number;
  total: number;
  ticker: string;
}

export function ProgressBar({ current, total, ticker }: ProgressBarProps) {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="mb-6 bg-card border border-border rounded-lg p-4">
      <div className="mb-2 flex justify-between items-center text-sm text-muted-foreground">
        <span>Scanning {ticker}...</span>
        <span>{current} / {total}</span>
      </div>
      
      <div className="h-9 bg-secondary/50 rounded-lg overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center text-sm font-semibold text-primary-foreground transition-all duration-300"
          style={{ width: `${percentage}%` }}
        >
          {percentage > 15 && `${percentage}%`}
        </div>
      </div>
      
      <p className="mt-2 text-xs text-muted-foreground text-center">
        Using cached data when available
      </p>
    </div>
  );
}
