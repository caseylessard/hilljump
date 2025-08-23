import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCacheStats, debugCache, resetCache, warmSpecificCache } from '@/lib/cacheUtils';
import { CACHE_TTLS } from '@/lib/cache';

export const CacheMonitor = () => {
  const [stats, setStats] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isWarming, setIsWarming] = useState(false);

  const handleWarmCache = async () => {
    setIsWarming(true);
    try {
      await warmSpecificCache('all');
    } finally {
      setIsWarming(false);
    }
  };

  useEffect(() => {
    const updateStats = () => {
      setStats(getCacheStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsVisible(true)}
          className="opacity-60 hover:opacity-100"
        >
          Cache
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Cache Monitor</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsVisible(false)}
            >
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {stats && (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Entries:</span>
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {stats.totalEntries}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Expired:</span>
                  <Badge variant={stats.expiredEntries > 0 ? "destructive" : "secondary"} className="ml-1 text-xs">
                    {stats.expiredEntries}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Hit Rate:</span>
                  <Badge variant="outline" className="ml-1 text-xs">
                    {stats.hitRate.toFixed(1)}%
                  </Badge>
                </div>
                {stats.memoryUsage && (
                  <div>
                    <span className="text-muted-foreground">Memory:</span>
                    <Badge variant="outline" className="ml-1 text-xs">
                      {(stats.memoryUsage.used / 1024 / 1024).toFixed(1)}MB
                    </Badge>
                  </div>
                )}
              </div>

              <div className="text-xs">
                <span className="text-muted-foreground">TTLs:</span>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  {Object.entries(CACHE_TTLS).map(([key, ttl]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize">{key}:</span>
                      <span className="text-muted-foreground">
                        {ttl >= 60 * 60 * 1000 
                          ? `${ttl / (60 * 60 * 1000)}h`
                          : ttl >= 60 * 1000 
                          ? `${ttl / (60 * 1000)}m`
                          : `${ttl / 1000}s`
                        }
                      </span>
                    </div>
                  ))}
                </div>
              </div>

               <div className="flex gap-2 pt-2">
                 <Button 
                   variant="outline" 
                   size="sm" 
                   onClick={debugCache}
                   className="text-xs h-7"
                 >
                   Debug
                 </Button>
                 <Button 
                   variant="outline" 
                   size="sm" 
                   onClick={handleWarmCache}
                   disabled={isWarming}
                   className="text-xs h-7"
                 >
                   {isWarming ? 'Loading...' : 'Reload'}
                 </Button>
                 <Button 
                   variant="outline" 
                   size="sm" 
                   onClick={resetCache}
                   className="text-xs h-7"
                 >
                   Clear
                 </Button>
               </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};