import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Play, Square, TrendingUp, Database, Clock } from 'lucide-react';
import { useETFStream } from '@/hooks/useETFStream';

const ETFStreamPanel: React.FC = () => {
  const {
    isStreaming,
    progress,
    streamData,
    stats,
    startStream,
    stopStream
  } = useETFStream();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            ETF Data Stream
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Live ETF Data Fetching</h3>
              <p className="text-sm text-muted-foreground">
                Stream ETF data efficiently to reduce API costs
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={startStream}
                disabled={isStreaming}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Start Stream
              </Button>
              {isStreaming && (
                <Button
                  onClick={stopStream}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
              )}
            </div>
          </div>

          {progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress.current} / {progress.total} ({progress.percentage}%)</span>
              </div>
              <Progress value={progress.percentage} className="w-full" />
            </div>
          )}

          {stats && (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{stats.processed}</div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.updated}</div>
                <div className="text-sm text-muted-foreground">Updated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {streamData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Stream Data ({streamData.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {streamData.slice(-20).reverse().map((item, index) => (
                  <div key={`${item.ticker}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{item.ticker}</Badge>
                      <div>
                        <div className="font-medium">{item.data.name}</div>
                        <div className="text-sm text-muted-foreground flex gap-2">
                          {item.data.yield && <span>Yield: {item.data.yield.toFixed(2)}%</span>}
                          {item.data.return1y && <span>1Y: {item.data.return1y.toFixed(2)}%</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {item.data.price && (
                        <div className="font-medium">${item.data.price.toFixed(2)}</div>
                      )}
                      {item.data.aum && (
                        <div className="text-sm text-muted-foreground">
                          AUM: ${(item.data.aum / 1000000).toFixed(0)}M
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ETFStreamPanel;