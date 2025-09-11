// Stub for performance monitoring
export const usePerformanceMonitor = (enabled: boolean = true) => {
  return {
    startTimer: () => {},
    endTimer: () => {},
    metrics: {},
    getPerformanceReport: (label: string) => ({ label, duration: 0 })
  };
};