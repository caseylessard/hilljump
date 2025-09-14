import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const ETFActivator = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; activatedCount?: number } | null>(null);
  const { toast } = useToast();

  const handleActivateETFs = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to activate ETFs.",
          variant: "destructive",
        });
        return;
      }

      // Direct database update instead of edge function
      const { error, count } = await supabase
        .from('etfs')
        .update({ active: true })
        .eq('active', false);

      if (error) {
        throw error;
      }

      const message = `Successfully activated ${count || 0} ETFs`;
      setResult({ success: true, message, activatedCount: count || 0 });
      toast({
        title: "ETFs Activated",
        description: message,
      });

    } catch (error) {
      console.error('Error activating ETFs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setResult({ success: false, message: `Error: ${errorMessage}` });
      toast({
        title: "Activation failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">Activate Imported ETFs</CardTitle>
        <CardDescription className="text-sm md:text-base">
          Activate all ETFs that were imported but set to inactive by default.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            <AlertDescription className="text-sm md:text-base">
              {result.message}
              {result.activatedCount !== undefined && (
                <span className="font-medium"> ({result.activatedCount} ETFs activated)</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={handleActivateETFs}
            disabled={isLoading}
            variant="default"
            className="w-full sm:w-auto text-sm md:text-base"
          >
            {isLoading ? 'Activating...' : 'Activate All Inactive ETFs'}
          </Button>
        </div>

        <Alert>
          <AlertDescription className="text-sm md:text-base">
            This will set all inactive ETFs to active status so they appear in the main ETF tables.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};