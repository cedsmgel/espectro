import { useState, useEffect } from 'react';

export interface VisualViewportState {
  height: number;
  width: number;
  offsetTop: number;
  isKeyboardOpen: boolean;
  isMobile: boolean;
}

export function useVisualViewport(): VisualViewportState {
  const [viewport, setViewport] = useState<VisualViewportState>(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      if (window.visualViewport) {
        const heightDiff = window.innerHeight - window.visualViewport.height;
        return {
          height: window.visualViewport.height,
          width: window.visualViewport.width,
          offsetTop: window.visualViewport.offsetTop,
          isKeyboardOpen: isMobile && heightDiff > 150,
          isMobile,
        };
      }
      return {
        height: window.innerHeight,
        width: window.innerWidth,
        offsetTop: 0,
        isKeyboardOpen: false,
        isMobile,
      };
    }
    return {
      height: 0,
      width: 0,
      offsetTop: 0,
      isKeyboardOpen: false,
      isMobile: false,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number | null = null;

    const updateViewport = () => {
      const isMobile = window.innerWidth < 768;
      const vv = window.visualViewport;

      if (vv) {
        const heightDiff = window.innerHeight - vv.height;
        setViewport({
          height: vv.height,
          width: vv.width,
          offsetTop: vv.offsetTop,
          isKeyboardOpen: isMobile && heightDiff > 150,
          isMobile,
        });
      } else {
        setViewport({
          height: window.innerHeight,
          width: window.innerWidth,
          offsetTop: 0,
          isKeyboardOpen: false,
          isMobile,
        });
      }
    };

    const handleViewportChange = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(updateViewport);
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleViewportChange);
      vv.addEventListener('scroll', handleViewportChange);
    }
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    // Initial update
    updateViewport();

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (vv) {
        vv.removeEventListener('resize', handleViewportChange);
        vv.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, []);

  return viewport;
}
