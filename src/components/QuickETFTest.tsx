import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Play, Square } from 'lucide-react';

const QuickETFTest: React.FC = () => {
  const [updating, setUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch last dividend update info
  React.useEffect(() => {
    const fetchLastUpdate = async () => {
      const { data } = await supabase
        .from('dividend_update_logs')
        .select('end_time, status, updated_etfs, inserted_events')
        .eq('status', 'completed')
        .order('end_time', { ascending: false })
        .limit(1)
        .single();
      
      if (data?.end_time) {
        setLastUpdate(data.end_time);
      }
    };
    
    fetchLastUpdate();
  }, []);

  const updateDividends = async () => {
    setUpdating(true);
    
    try {
      toast({
        title: "Fetching Dividends",
        description: "Starting dividend data update...",
      });

      const { data, error } = await supabase.functions.invoke('dividend-updater', {
        body: {}
      });
      
      if (error) {
        console.error('Dividend update failed:', error);
        toast({
          title: "Update Failed",
          description: error.message || "Failed to update dividend data",
          variant: "destructive",
        });
      } else {
        console.log('Dividend update completed:', data);
        toast({
          title: "Update Complete",
          description: `Updated ${data.updated || 0} ETFs with ${data.insertedEvents || 0} dividend events from ${data.totalETFs || 0} total ETFs`,
        });
        
        // Refresh last update time
        setLastUpdate(new Date().toISOString());
      }
    } catch (err: any) {
      console.error('Error:', err);
      toast({
        title: "Error",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Update Latest Dividend Data</span>
          <Button 
            onClick={updateDividends} 
            disabled={updating}
            className="flex items-center gap-2"
          >
            {updating ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {updating ? 'Fetching...' : 'Fetch Latest Dividends'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Fetches the latest dividend announcements and ex-dividend dates for all ETFs, including new distributions like MARO's August 15 announcement.
        </p>
        
        {lastUpdate && (
          <div className="text-xs text-muted-foreground">
            Last updated: {new Date(lastUpdate).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuickETFTest;