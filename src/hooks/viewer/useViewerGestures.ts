/**
 * Mobile-optimized gesture hook for image viewer
 * Supports pinch-to-zoom, momentum panning, double-tap zoom
 * Optimized for iPhone and iPad
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGesture } from '@use-gesture/react';

interface Point {
  x: number;
  y: number;
}

interface ViewerGestureOptions {
  minZoom?: number;
  maxZoom?: number;
  doubleTapZoom?: number;
  momentumFriction?: number;
  boundaryPadding?: number;
}

interface ViewerGestureState {
  scale: number;
  position: Point;
  isGesturing: boolean;
  isPinching: boolean;
}

export function useViewerGestures(options: ViewerGestureOptions = {}) {
  const {
    minZoom = 0.5,
    maxZoom = 10,
    doubleTapZoom = 2.5,
    momentumFriction = 0.95,
    boundaryPadding = 50,
  } = options;

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = useState(false);
  const [isPinching, setIsPinching] = useState(false);

  // Refs for gesture state
  const initialScale = useRef(1);
  const initialPosition = useRef<Point>({ x: 0, y: 0 });
  const velocity = useRef<Point>({ x: 0, y: 0 });
  const momentumFrame = useRef<number>();
  const lastTapTime = useRef(0);
  const lastTapPosition = useRef<Point>({ x: 0, y: 0 });
  const containerSize = useRef({ width: 0, height: 0 });

  // Clamp scale within bounds
  const clampScale = useCallback((s: number) => {
    return Math.max(minZoom, Math.min(maxZoom, s));
  }, [minZoom, maxZoom]);

  // Clamp position to keep image visible
  const clampPosition = useCallback((pos: Point, currentScale: number): Point => {
    if (currentScale <= 1) return { x: 0, y: 0 };
    
    const maxPan = Math.max(0, (currentScale - 1) * boundaryPadding * 2);
    return {
      x: Math.max(-maxPan, Math.min(maxPan, pos.x)),
      y: Math.max(-maxPan, Math.min(maxPan, pos.y)),
    };
  }, [boundaryPadding]);

  // Apply momentum after drag release
  const applyMomentum = useCallback(() => {
    if (Math.abs(velocity.current.x) < 0.5 && Math.abs(velocity.current.y) < 0.5) {
      velocity.current = { x: 0, y: 0 };
      return;
    }

    velocity.current = {
      x: velocity.current.x * momentumFriction,
      y: velocity.current.y * momentumFriction,
    };

    setPosition((prev) => {
      const newPos = {
        x: prev.x + velocity.current.x,
        y: prev.y + velocity.current.y,
      };
      return clampPosition(newPos, scale);
    });

    momentumFrame.current = requestAnimationFrame(applyMomentum);
  }, [momentumFriction, clampPosition, scale]);

  // Stop momentum
  const stopMomentum = useCallback(() => {
    if (momentumFrame.current) {
      cancelAnimationFrame(momentumFrame.current);
      momentumFrame.current = undefined;
    }
    velocity.current = { x: 0, y: 0 };
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    stopMomentum();
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [stopMomentum]);

  // Zoom to specific scale at point
  const zoomToPoint = useCallback((newScale: number, point: Point, containerRect: DOMRect) => {
    const clampedScale = clampScale(newScale);
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    
    // Calculate offset from center
    const offsetX = (point.x - containerRect.left - centerX);
    const offsetY = (point.y - containerRect.top - centerY);
    
    // Calculate new position to zoom toward point
    const scaleRatio = clampedScale / scale;
    const newX = position.x - offsetX * (scaleRatio - 1) / clampedScale;
    const newY = position.y - offsetY * (scaleRatio - 1) / clampedScale;
    
    setScale(clampedScale);
    setPosition(clampPosition({ x: newX, y: newY }, clampedScale));
  }, [scale, position, clampScale, clampPosition]);

  // Handle double tap
  const handleDoubleTap = useCallback((point: Point, containerRect: DOMRect) => {
    if (scale > 1.1) {
      // Zoom out
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      // Zoom in to double tap position
      zoomToPoint(doubleTapZoom, point, containerRect);
    }
  }, [scale, doubleTapZoom, zoomToPoint]);

  // Main gesture binding
  const bind = useGesture(
    {
      onDrag: ({ movement: [mx, my], velocity: [vx, vy], down, first, last, event, memo }) => {
        // Prevent default to stop Safari bouncing
        event?.preventDefault();
        
        if (first) {
          stopMomentum();
          initialPosition.current = position;
          setIsGesturing(true);
        }

        if (down) {
          // Only allow panning when zoomed in
          if (scale > 1) {
            const newPos = {
              x: initialPosition.current.x + mx / scale,
              y: initialPosition.current.y + my / scale,
            };
            setPosition(clampPosition(newPos, scale));
          }
        }

        if (last) {
          setIsGesturing(false);
          
          // Apply momentum if moving fast enough
          if (scale > 1 && (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1)) {
            velocity.current = { x: vx * 10, y: vy * 10 };
            applyMomentum();
          }
        }

        return memo;
      },
      onPinch: ({ origin: [ox, oy], first, last, offset: [s], event, memo }) => {
        // Prevent default to stop Safari zoom
        event?.preventDefault();
        
        if (first) {
          stopMomentum();
          initialScale.current = scale;
          initialPosition.current = position;
          setIsPinching(true);
          setIsGesturing(true);
          
          // Store container rect
          const target = event?.currentTarget as HTMLElement;
          if (target) {
            const rect = target.getBoundingClientRect();
            containerSize.current = { width: rect.width, height: rect.height };
          }
        }

        const newScale = clampScale(s);
        
        // Calculate zoom toward pinch center
        const centerX = containerSize.current.width / 2;
        const centerY = containerSize.current.height / 2;
        const offsetX = ox - centerX;
        const offsetY = oy - centerY;
        
        const scaleRatio = newScale / initialScale.current;
        const newX = initialPosition.current.x - offsetX * (scaleRatio - 1) / newScale;
        const newY = initialPosition.current.y - offsetY * (scaleRatio - 1) / newScale;
        
        setScale(newScale);
        setPosition(clampPosition({ x: newX, y: newY }, newScale));

        if (last) {
          setIsPinching(false);
          setIsGesturing(false);
        }

        return memo;
      },
      onWheel: ({ delta: [, dy], event }) => {
        event?.preventDefault();
        const delta = dy > 0 ? -0.15 : 0.15;
        const newScale = clampScale(scale + delta);
        
        const target = event?.currentTarget as HTMLElement;
        if (target && event) {
          const rect = target.getBoundingClientRect();
          zoomToPoint(newScale, { x: (event as WheelEvent).clientX, y: (event as WheelEvent).clientY }, rect);
        } else {
          setScale(newScale);
        }
      },
    },
    {
      drag: {
        filterTaps: true,
        threshold: 5,
        pointer: { touch: true },
      },
      pinch: {
        scaleBounds: { min: minZoom, max: maxZoom },
        rubberband: true,
        pointer: { touch: true },
      },
      wheel: {
        eventOptions: { passive: false },
      },
    }
  );

  // Handle tap events separately for double-tap detection
  const handleTap = useCallback((e: React.PointerEvent | React.TouchEvent) => {
    const now = Date.now();
    const point = 'touches' in e 
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: (e as React.PointerEvent).clientX, y: (e as React.PointerEvent).clientY };
    
    const timeDiff = now - lastTapTime.current;
    const distance = Math.hypot(
      point.x - lastTapPosition.current.x,
      point.y - lastTapPosition.current.y
    );

    // Double tap detection (within 300ms and 50px)
    if (timeDiff < 300 && distance < 50) {
      const target = e.currentTarget as HTMLElement;
      if (target) {
        handleDoubleTap(point, target.getBoundingClientRect());
      }
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
      lastTapPosition.current = point;
    }
  }, [handleDoubleTap]);

  // Manual zoom controls
  const zoomIn = useCallback(() => {
    setScale((prev) => clampScale(prev + 0.5));
  }, [clampScale]);

  const zoomOut = useCallback(() => {
    const newScale = clampScale(scale - 0.5);
    setScale(newScale);
    if (newScale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale, clampScale]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMomentum();
    };
  }, [stopMomentum]);

  return {
    bind,
    scale,
    position,
    isGesturing,
    isPinching,
    resetView,
    zoomIn,
    zoomOut,
    handleTap,
  };
}
