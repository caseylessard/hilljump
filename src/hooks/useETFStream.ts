import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface StreamData {
  ticker: string;
  data: {
    name: string;
    yield?: number;
    aum?: number;
    volume?: number;
    return1y?: number;
    price?: number;
  };
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
}

interface StreamStats {
  total: number;
  updated: number;
  processed: number;
}

export const useETFStream = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; percentage: number } | null>(null);
  const [streamData, setStreamData] = useState<StreamData[]>([]);
  const [stats, setStats] = useState<StreamStats | null>(null);
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  const startStream = useCallback(() => {
    if (isStreaming) return;

    setIsStreaming(true);
    setProgress(null);
    setStreamData([]);
    setStats(null);

    // Use the full WebSocket URL for the edge function
    const wsUrl = `wss://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/etf-stream`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('ETF stream connected');
      toast({
        title: "Stream Connected",
        description: "Starting ETF data fetch...",
      });
    };

    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'connected':
          console.log('Stream ready:', message.message);
          break;
          
        case 'progress':
          console.log('Progress:', message.message);
          if (message.total) {
            setProgress({ current: 0, total: message.total, percentage: 0 });
          }
          break;
          
        case 'data':
          console.log(`Received data for ${message.ticker}:`, message.data);
          setStreamData(prev => [...prev, message]);
          setProgress(message.progress);
          break;
          
        case 'database_updated':
          console.log('Database updated:', message.message);
          toast({
            title: "Database Updated",
            description: message.message,
          });
          break;
          
        case 'complete':
          console.log('Stream complete:', message.message);
          setStats(message.stats);
          toast({
            title: "Stream Complete",
            description: message.message,
          });
          setIsStreaming(false);
          break;
          
        case 'error':
          console.error('Stream error:', message.message);
          toast({
            title: "Stream Error",
            description: message.message,
            variant: "destructive",
          });
          setIsStreaming(false);
          break;
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to ETF stream",
        variant: "destructive",
      });
      setIsStreaming(false);
    };

    wsRef.current.onclose = () => {
      console.log('ETF stream disconnected');
      setIsStreaming(false);
    };
  }, [isStreaming, toast]);

  const stopStream = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return {
    isStreaming,
    progress,
    streamData,
    stats,
    startStream,
    stopStream
  };
};