import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Maximize, RotateCw, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SphericalImage {
  id: string;
  original_url: string;
  thumbnail_url: string | null;
  medium_url: string | null;
  large_url: string | null;
  display_order: number;
}

interface SphericalPanoramaViewerProps {
  images: SphericalImage[];
  className?: string;
}

/**
 * Creates a canvas-based texture for a sphere slice with alpha-blended edges.
 */
function createBlendedTexture(
  image: HTMLImageElement,
  overlapFraction: number = 0.12
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d")!;

  // Draw the image
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Apply alpha gradient on left edge
  const edgeWidth = Math.floor(canvas.width * overlapFraction);
  const leftGrad = ctx.createLinearGradient(0, 0, edgeWidth, 0);
  leftGrad.addColorStop(0, "rgba(0,0,0,1)"); // fully transparent
  leftGrad.addColorStop(1, "rgba(0,0,0,0)"); // fully opaque
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, edgeWidth, canvas.height);

  // Apply alpha gradient on right edge
  const rightGrad = ctx.createLinearGradient(
    canvas.width - edgeWidth,
    0,
    canvas.width,
    0
  );
  rightGrad.addColorStop(0, "rgba(0,0,0,0)");
  rightGrad.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = rightGrad;
  ctx.fillRect(canvas.width - edgeWidth, 0, edgeWidth, canvas.height);

  ctx.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function getImageUrl(img: SphericalImage): string {
  return img.medium_url || img.large_url || img.original_url;
}

/**
 * A single sphere slice mesh covering a sector of longitude.
 */
function SphereSlice({
  texture,
  index,
  total,
  radius,
  overlapFraction,
}: {
  texture: THREE.CanvasTexture;
  index: number;
  total: number;
  radius: number;
  overlapFraction: number;
}) {
  const sectorAngle = (Math.PI * 2) / total;
  const overlap = sectorAngle * overlapFraction;
  const startAngle = index * sectorAngle - overlap;
  const sweepAngle = sectorAngle + overlap * 2;

  // SphereGeometry(radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength)
  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(
      radius,
      32,
      24,
      startAngle,
      sweepAngle,
      0,
      Math.PI
    );
    return geo;
  }, [radius, startAngle, sweepAngle]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Scene content: loads textures and renders sphere slices.
 */
function PanoramaScene({
  images,
  autoRotate,
}: {
  images: SphericalImage[];
  autoRotate: boolean;
}) {
  const [textures, setTextures] = useState<(THREE.CanvasTexture | null)[]>([]);
  const controlsRef = useRef<any>(null);
  const radius = 500;
  const overlapFraction = 0.12;

  // Load all images and create blended textures
  useEffect(() => {
    let cancelled = false;
    const sorted = [...images].sort((a, b) => a.display_order - b.display_order);

    const loadAll = async () => {
      const results: (THREE.CanvasTexture | null)[] = [];

      for (const img of sorted) {
        if (cancelled) return;
        try {
          const htmlImg = await new Promise<HTMLImageElement>(
            (resolve, reject) => {
              const el = new Image();
              el.crossOrigin = "anonymous";
              el.onload = () => resolve(el);
              el.onerror = reject;
              el.src = getImageUrl(img);
            }
          );
          if (cancelled) return;
          results.push(createBlendedTexture(htmlImg, overlapFraction));
        } catch {
          results.push(null);
        }
      }

      if (!cancelled) setTextures(results);
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [images]);

  // Auto-rotate
  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 0.5;
      controlsRef.current.update();
    }
  });

  const validTextures = textures.filter(
    (t): t is THREE.CanvasTexture => t !== null
  );

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        minDistance={1}
        maxDistance={radius * 0.9}
        rotateSpeed={-0.3}
        zoomSpeed={0.8}
        enableDamping
        dampingFactor={0.1}
        // Reverse rotation direction so dragging left looks left
        reverseOrbit
      />
      {validTextures.map((tex, i) => (
        <SphereSlice
          key={i}
          texture={tex}
          index={i}
          total={validTextures.length}
          radius={radius}
          overlapFraction={overlapFraction}
        />
      ))}
    </>
  );
}

export function SphericalPanoramaViewer({
  images,
  className = "",
}: SphericalPanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [loading, setLoading] = useState(true);

  // Simple loading state — hide after a short delay once images start arriving
  useEffect(() => {
    if (images.length > 0) {
      const t = setTimeout(() => setLoading(false), 1500);
      return () => clearTimeout(t);
    }
  }, [images.length]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative bg-black ${className}`}
      style={{ touchAction: "none" }}
    >
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <div className="text-center space-y-3">
            <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-white/60">Building 360° view…</p>
          </div>
        </div>
      )}

      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1100, position: [0, 0, 0.1] }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true, alpha: false }}
      >
        <PanoramaScene images={images} autoRotate={autoRotate} />
      </Canvas>

      {/* Controls overlay */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/20 bg-black/40 backdrop-blur-sm"
          onClick={() => setAutoRotate(!autoRotate)}
        >
          {autoRotate ? (
            <Pause className="h-4 w-4" />
          ) : (
            <RotateCw className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/20 bg-black/40 backdrop-blur-sm"
          onClick={toggleFullscreen}
        >
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      {/* Info badge */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-black/60 backdrop-blur-sm text-white/80 px-4 py-1.5 rounded-full text-xs pointer-events-none">
        360° View — Drag to look around
      </div>
    </div>
  );
}
