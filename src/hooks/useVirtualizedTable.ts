import { useMemo, useState, useEffect } from 'react';

export interface VirtualizedTableConfig {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export const useVirtualizedTable = <T>(
  items: T[],
  config: VirtualizedTableConfig
) => {
  const { itemHeight, containerHeight, overscan = 5 } = config;
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(items.length - 1, startIndex + visibleCount + 2 * overscan);
    
    return { startIndex, endIndex, visibleCount };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange.startIndex, visibleRange.endIndex]);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  return {
    visibleItems,
    visibleRange,
    totalHeight,
    offsetY,
    handleScroll,
    containerProps: {
      style: { height: containerHeight, overflow: 'auto' },
      onScroll: handleScroll,
    },
    contentProps: {
      style: { height: totalHeight, position: 'relative' as const },
    },
    itemProps: {
      style: { 
        position: 'absolute' as const, 
        top: offsetY,
        width: '100%' 
      },
    },
  };
};