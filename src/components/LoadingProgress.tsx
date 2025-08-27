import { Loader2, Clock } from "lucide-react";

interface LoadingProgressProps {
  etfsLoading: boolean;
  pricesLoading: boolean;
  distributionsLoading: boolean;
  scoresLoading: boolean;
  yieldsLoading: boolean;
  lastUpdated?: Date;
  pricesProgress?: { current: number; total: number };
  distributionsProgress?: { current: number; total: number };
  scoresProgress?: { current: number; total: number };
}

export const LoadingProgress = ({ 
  etfsLoading, 
  pricesLoading, 
  distributionsLoading, 
  scoresLoading, 
  yieldsLoading,
  lastUpdated,
  pricesProgress,
  distributionsProgress,
  scoresProgress
}: LoadingProgressProps) => {
  // Determine current loading state
  const getCurrentState = () => {
    if (etfsLoading) return { text: "Loading ETF data", loading: true };
    
    if (pricesLoading) {
      const progressText = pricesProgress 
        ? `Loading ${pricesProgress.current} of ${pricesProgress.total} prices`
        : "Loading prices";
      return { text: progressText, loading: true };
    }
    
    if (distributionsLoading) {
      const progressText = distributionsProgress 
        ? `Loading ${distributionsProgress.current} of ${distributionsProgress.total} distributions`
        : "Loading distributions";
      return { text: progressText, loading: true };
    }
    
    if (scoresLoading) {
      const progressText = scoresProgress 
        ? `Calculating ${scoresProgress.current} of ${scoresProgress.total} scores`
        : "Calculating scores";
      return { text: progressText, loading: true };
    }
    
    if (yieldsLoading) return { text: "Loading yields", loading: true };
    
    // All done - show last updated
    if (lastUpdated) {
      return { 
        text: `Last updated: ${lastUpdated.toLocaleTimeString()}`, 
        loading: false 
      };
    }
    
    return { text: "Ready", loading: false };
  };

  const currentState = getCurrentState();

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
      {currentState.loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Clock className="h-4 w-4" />
      )}
      <span>{currentState.text}</span>
    </div>
  );
};