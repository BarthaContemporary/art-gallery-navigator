
import { useState, useEffect } from 'react';

export function useContainerWidth(containerId: string): number {
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const measureWidth = () => {
      const container = document.getElementById(containerId);
      if (container) {
        setContainerWidth(container.clientWidth);
      }
    };

    // RAF to ensure layout is stable before measuring
    requestAnimationFrame(() => {
        measureWidth(); 
    });
    
    window.addEventListener('resize', measureWidth);
    return () => window.removeEventListener('resize', measureWidth);
  }, [containerId]);

  return containerWidth;
}
