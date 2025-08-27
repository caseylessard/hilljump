import { Loader2, Clock } from "lucide-react";

interface LoadingProgressProps {
  etfsLoading: boolean;
  pricesLoading: boolean;
  distributionsLoading: boolean;
  scoresLoading: boolean;
  yieldsLoading: boolean;
  lastUpdated?: Date;
}

export const LoadingProgress = ({ 
  etfsLoading, 
  pricesLoading, 
  distributionsLoading, 
  scoresLoading, 
  yieldsLoading,
  lastUpdated 
}: LoadingProgressProps) => {
  // Determine current loading state
  const getCurrentState = () => {
    if (etfsLoading) return { text: "Loading ETF data", loading: true };
    if (pricesLoading) return { text: "Loading prices", loading: true };
    if (distributionsLoading) return { text: "Loading distributions", loading: true };
    if (scoresLoading) return { text: "Calculating scores", loading: true };
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