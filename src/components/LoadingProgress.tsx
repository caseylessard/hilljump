import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface LoadingProgressProps {
  etfsLoading: boolean;
  pricesLoading: boolean;
  distributionsLoading: boolean;
  scoresLoading: boolean;
  yieldsLoading: boolean;
}

interface LoadingStep {
  id: string;
  label: string;
  isLoading: boolean;
  isComplete: boolean;
}

export const LoadingProgress = ({ 
  etfsLoading, 
  pricesLoading, 
  distributionsLoading, 
  scoresLoading, 
  yieldsLoading 
}: LoadingProgressProps) => {
  const steps: LoadingStep[] = [
    {
      id: "data",
      label: "Loading ETF data",
      isLoading: etfsLoading,
      isComplete: !etfsLoading
    },
    {
      id: "prices",
      label: "Loading prices",
      isLoading: pricesLoading && !etfsLoading,
      isComplete: !pricesLoading && !etfsLoading
    },
    {
      id: "distributions",
      label: "Loading distributions",
      isLoading: distributionsLoading && !pricesLoading && !etfsLoading,
      isComplete: !distributionsLoading && !pricesLoading && !etfsLoading
    },
    {
      id: "scores",
      label: "Calculating scores",
      isLoading: scoresLoading && !distributionsLoading && !pricesLoading && !etfsLoading,
      isComplete: !scoresLoading && !distributionsLoading && !pricesLoading && !etfsLoading
    }
  ];

  const isAnyLoading = etfsLoading || pricesLoading || distributionsLoading || scoresLoading || yieldsLoading;
  
  if (!isAnyLoading) return null;

  const completedSteps = steps.filter(step => step.isComplete).length;
  const totalSteps = steps.length;
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <Card className="p-6 mb-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Loading Market Data</h3>
          <span className="text-sm text-muted-foreground">
            {completedSteps} of {totalSteps} complete
          </span>
        </div>
        
        <Progress value={progress} className="h-2" />
        
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {step.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : step.isComplete ? (
                  <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                  </div>
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
              </div>
              <span 
                className={`text-sm ${
                  step.isComplete 
                    ? 'text-foreground' 
                    : step.isLoading 
                      ? 'text-primary font-medium' 
                      : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};