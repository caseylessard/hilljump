import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  timestamp: number;
}

export const usePerformanceMonitor = (componentName: string) => {
  const renderStartTime = useRef<number>(0);
  const metricsRef = useRef<PerformanceMetrics[]>([]);

  // Start timing at the beginning of render
  renderStartTime.current = performance.now();

  useEffect(() => {
    // End timing after render is complete
    const renderTime = performance.now() - renderStartTime.current;
    
    const metric: PerformanceMetrics = {
      componentName,
      renderTime,
      timestamp: Date.now()
    };
    
    metricsRef.current.push(metric);
    
    // Keep only last 10 measurements
    if (metricsRef.current.length > 10) {
      metricsRef.current = metricsRef.current.slice(-10);
    }
    
    // Log slow renders in development
    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      console.warn(`⚠️ Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
    }
    
    // Log performance improvements
    if (metricsRef.current.length > 1) {
      const previousRender = metricsRef.current[metricsRef.current.length - 2];
      const improvement = previousRender.renderTime - renderTime;
      
      if (improvement > 5) {
        console.log(`⚡ Performance improvement in ${componentName}: ${improvement.toFixed(2)}ms faster`);
      }
    }
  });

  const getAverageRenderTime = () => {
    if (metricsRef.current.length === 0) return 0;
    
    const totalTime = metricsRef.current.reduce((sum, metric) => sum + metric.renderTime, 0);
    return totalTime / metricsRef.current.length;
  };

  const getPerformanceReport = () => {
    const metrics = metricsRef.current;
    if (metrics.length === 0) return null;

    const avgRenderTime = getAverageRenderTime();
    const minRenderTime = Math.min(...metrics.map(m => m.renderTime));
    const maxRenderTime = Math.max(...metrics.map(m => m.renderTime));

    return {
      componentName,
      samples: metrics.length,
      averageRenderTime: avgRenderTime,
      minRenderTime,
      maxRenderTime,
      lastRenderTime: metrics[metrics.length - 1]?.renderTime || 0,
      isPerformant: avgRenderTime < 16, // 60fps = 16.67ms per frame
    };
  };

  return {
    getAverageRenderTime,
    getPerformanceReport,
    metrics: metricsRef.current,
  };
};
