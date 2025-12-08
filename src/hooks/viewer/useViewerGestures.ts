/**
 * Mobile-optimized gesture hook for image viewer
 * Supports pinch-to-zoom, momentum panning, double-tap zoom
 * Optimized for iPhone and iPad with proper touch handling
 */

import { useState, useCallback, useRef, useEffect, RefObject } from 'react';
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
}

interface ViewerGestureState {
  scale: number;
  position: Point;
  isGesturing: boolean;
  isPinching: boolean;
}

export function useViewerGestures(
  containerRef: RefObject<HTMLElement>,
  options: ViewerGestureOptions = {}
) {
  const {
    minZoom = 0.5,
    maxZoom = 10,
    doubleTapZoom = 2.5,
    momentumFriction = 0.92,
  } = options;

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = useState(false);
  const [isPinching, setIsPinching] = useState(false);

  // Refs for gesture state
  const scaleRef = useRef(scale);
  const positionRef = useRef(position);
  const initialPinchScale = useRef(1);
  const initialPinchPosition = useRef<Point>({ x: 0, y: 0 });
  const velocity = useRef<Point>({ x: 0, y: 0 });
  const momentumFrame = useRef<number>();
  const lastTapTime = useRef(0);
  const lastTapPosition = useRef<Point>({ x: 0, y: 0 });

  // Keep refs in sync with state
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Clamp scale within bounds
  const clampScale = useCallback((s: number) => {
    return Math.max(minZoom, Math.min(maxZoom, s));
  }, [minZoom, maxZoom]);

  // Clamp position based on actual container dimensions and current scale
  const clampPosition = useCallback((pos: Point, currentScale: number): Point => {
    if (currentScale <= 1) return { x: 0, y: 0 };
    
    const container = containerRef.current;
    if (!container) return pos;
    
    const rect = container.getBoundingClientRect();
    
    // Calculate how much the scaled content exceeds the container
    const overflowX = Math.max(0, (rect.width * currentScale - rect.width) / 2);
    const overflowY = Math.max(0, (rect.height * currentScale - rect.height) / 2);
    
    return {
      x: Math.max(-overflowX, Math.min(overflowX, pos.x)),
      y: Math.max(-overflowY, Math.min(overflowY, pos.y)),
    };
  }, [containerRef]);

  // Apply momentum after drag release
  const applyMomentum = useCallback(() => {
    const currentScale = scaleRef.current;
    
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
      return clampPosition(newPos, currentScale);
    });

    momentumFrame.current = requestAnimationFrame(applyMomentum);
  }, [momentumFriction, clampPosition]);

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

  // Handle double tap zoom
  const handleDoubleTap = useCallback((point: Point) => {
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const currentScale = scaleRef.current;
    
    if (currentScale > 1.1) {
      // Zoom out to 1x
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      // Zoom in toward tap point
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const offsetX = point.x - rect.left - centerX;
      const offsetY = point.y - rect.top - centerY;
      
      const newScale = doubleTapZoom;
      const scaleRatio = newScale / currentScale;
      
      // Calculate new position to zoom toward tap point
      const newX = -offsetX * (scaleRatio - 1);
      const newY = -offsetY * (scaleRatio - 1);
      
      setScale(newScale);
      setPosition(clampPosition({ x: newX, y: newY }, newScale));
    }
  }, [containerRef, doubleTapZoom, clampPosition]);

  // Main gesture binding with target-based approach for iOS
  useGesture(
    {
      onDrag: ({ 
        movement: [mx, my], 
        velocity: [vx, vy], 
        down, 
        first, 
        last, 
        tap,
        event,
        xy: [x, y],
      }) => {
        // Prevent default to stop iOS Safari bounce
        if (event?.cancelable) {
          event.preventDefault();
        }

        // Handle tap for double-tap detection
        if (tap) {
          const now = Date.now();
          const point = { x, y };
          const timeDiff = now - lastTapTime.current;
          const distance = Math.hypot(
            point.x - lastTapPosition.current.x,
            point.y - lastTapPosition.current.y
          );

          if (timeDiff < 300 && distance < 50) {
            handleDoubleTap(point);
            lastTapTime.current = 0;
          } else {
            lastTapTime.current = now;
            lastTapPosition.current = point;
          }
          return;
        }
        
        if (first) {
          stopMomentum();
          setIsGesturing(true);
        }

        const currentScale = scaleRef.current;
        
        if (down && currentScale > 1) {
          // Calculate new position from movement
          const newPos = {
            x: positionRef.current.x + mx,
            y: positionRef.current.y + my,
          };
          setPosition(clampPosition(newPos, currentScale));
        }

        if (last) {
          setIsGesturing(false);
          
          // Apply momentum if moving fast enough when zoomed
          if (currentScale > 1 && (Math.abs(vx) > 0.2 || Math.abs(vy) > 0.2)) {
            // Velocity is in px/ms, scale it appropriately
            velocity.current = { x: vx * 15, y: vy * 15 };
            requestAnimationFrame(applyMomentum);
          }
        }
      },
      onPinch: ({ 
        origin: [ox, oy], 
        first, 
        last, 
        offset: [s], 
        event,
      }) => {
        // Prevent default to stop Safari zoom
        if (event?.cancelable) {
          event.preventDefault();
        }
        
        const container = containerRef.current;
        if (!container) return;
        
        if (first) {
          stopMomentum();
          initialPinchScale.current = scaleRef.current;
          initialPinchPosition.current = positionRef.current;
          setIsPinching(true);
          setIsGesturing(true);
        }

        const newScale = clampScale(s);
        const rect = container.getBoundingClientRect();
        
        // Calculate zoom toward pinch center
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const pinchX = ox - rect.left;
        const pinchY = oy - rect.top;
        const offsetX = pinchX - centerX;
        const offsetY = pinchY - centerY;
        
        const scaleRatio = newScale / initialPinchScale.current;
        const newX = initialPinchPosition.current.x - offsetX * (scaleRatio - 1);
        const newY = initialPinchPosition.current.y - offsetY * (scaleRatio - 1);
        
        setScale(newScale);
        setPosition(clampPosition({ x: newX, y: newY }, newScale));

        if (last) {
          setIsPinching(false);
          setIsGesturing(false);
        }
      },
      onWheel: ({ delta: [, dy], event }) => {
        if (event?.cancelable) {
          event.preventDefault();
        }
        
        const container = containerRef.current;
        if (!container || !event) return;
        
        const delta = dy > 0 ? -0.15 : 0.15;
        const currentScale = scaleRef.current;
        const newScale = clampScale(currentScale + delta);
        
        const rect = container.getBoundingClientRect();
        const wheelEvent = event as WheelEvent;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const mouseX = wheelEvent.clientX - rect.left;
        const mouseY = wheelEvent.clientY - rect.top;
        const offsetX = mouseX - centerX;
        const offsetY = mouseY - centerY;
        
        const scaleRatio = newScale / currentScale;
        const currentPos = positionRef.current;
        const newX = currentPos.x - offsetX * (scaleRatio - 1);
        const newY = currentPos.y - offsetY * (scaleRatio - 1);
        
        setScale(newScale);
        setPosition(clampPosition({ x: newX, y: newY }, newScale));
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      drag: {
        from: () => [0, 0], // Always start from 0, we track position separately
        filterTaps: true,
        threshold: 3,
        pointer: { 
          touch: true,
          capture: false, // Critical for iOS
        },
        preventDefault: true,
      },
      pinch: {
        scaleBounds: { min: minZoom, max: maxZoom },
        rubberband: true,
        pointer: { touch: true },
        preventDefault: true,
      },
    }
  );

  // Manual zoom controls
  const zoomIn = useCallback(() => {
    setScale((prev) => clampScale(prev + 0.5));
  }, [clampScale]);

  const zoomOut = useCallback(() => {
    const newScale = clampScale(scaleRef.current - 0.5);
    setScale(newScale);
    if (newScale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [clampScale]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMomentum();
    };
  }, [stopMomentum]);

  // iOS document-level touch prevention during gestures
  useEffect(() => {
    const preventBounce = (e: TouchEvent) => {
      // Only prevent when actively gesturing on the viewer
      if (isGesturing && e.cancelable) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('touchmove', preventBounce, { passive: false });
    return () => document.removeEventListener('touchmove', preventBounce);
  }, [isGesturing]);

  return {
    scale,
    position,
    isGesturing,
    isPinching,
    resetView,
    zoomIn,
    zoomOut,
  };
}
