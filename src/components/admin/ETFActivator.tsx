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

      const { data, error } = await supabase.functions.invoke('activate-etfs', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      setResult(data);
      toast({
        title: "ETFs Activated",
        description: data.message,
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
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Activate Imported ETFs</CardTitle>
        <CardDescription>
          Activate all ETFs that were imported but set to inactive by default.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            <AlertDescription>
              {result.message}
              {result.activatedCount !== undefined && (
                <span className="font-medium"> ({result.activatedCount} ETFs activated)</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={handleActivateETFs}
            disabled={isLoading}
            variant="default"
          >
            {isLoading ? 'Activating...' : 'Activate All Inactive ETFs'}
          </Button>
        </div>

        <Alert>
          <AlertDescription>
            This will set all inactive ETFs to active status so they appear in the main ETF tables.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};