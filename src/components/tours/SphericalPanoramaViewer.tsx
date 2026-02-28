import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Maximize, RotateCw, Pause, Loader2 } from "lucide-react";
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
  stitchedPanoramaUrl?: string | null;
  className?: string;
}

function getImageUrl(img: SphericalImage): string {
  return img.medium_url || img.large_url || img.original_url;
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
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const edgeWidth = Math.floor(canvas.width * overlapFraction);
  ctx.globalCompositeOperation = "destination-out";

  const leftGrad = ctx.createLinearGradient(0, 0, edgeWidth, 0);
  leftGrad.addColorStop(0, "rgba(0,0,0,1)");
  leftGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, edgeWidth, canvas.height);

  const rightGrad = ctx.createLinearGradient(canvas.width - edgeWidth, 0, canvas.width, 0);
  rightGrad.addColorStop(0, "rgba(0,0,0,0)");
  rightGrad.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = rightGrad;
  ctx.fillRect(canvas.width - edgeWidth, 0, edgeWidth, canvas.height);

  ctx.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Renders a single equirectangular panorama on a sphere.
 */
function EquirectangularScene({ url, autoRotate }: { url: string; autoRotate: boolean }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.mapping = THREE.EquirectangularReflectionMapping;
        setTexture(tex);
      },
      undefined,
      (err) => console.error("Failed to load panorama texture:", err)
    );
  }, [url]);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 0.5;
      controlsRef.current.update();
    }
  });

  if (!texture) return null;

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        minDistance={1}
        maxDistance={450}
        rotateSpeed={-0.3}
        zoomSpeed={0.8}
        enableDamping
        dampingFactor={0.1}
        reverseOrbit
      />
      <mesh>
        <sphereGeometry args={[500, 64, 32]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} />
      </mesh>
    </>
  );
}

/**
 * Renders multiple images as blended slices on a sphere (fallback).
 */
function SlicedScene({ images, autoRotate }: { images: SphericalImage[]; autoRotate: boolean }) {
  const [textures, setTextures] = useState<(THREE.CanvasTexture | null)[]>([]);
  const controlsRef = useRef<any>(null);
  const radius = 500;
  const overlapFraction = 0.12;

  useEffect(() => {
    let cancelled = false;
    const sorted = [...images].sort((a, b) => a.display_order - b.display_order);

    const loadAll = async () => {
      const results: (THREE.CanvasTexture | null)[] = [];
      for (const img of sorted) {
        if (cancelled) return;
        try {
          const htmlImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.crossOrigin = "anonymous";
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = getImageUrl(img);
          });
          if (cancelled) return;
          results.push(createBlendedTexture(htmlImg, overlapFraction));
        } catch {
          results.push(null);
        }
      }
      if (!cancelled) setTextures(results);
    };

    loadAll();
    return () => { cancelled = true; };
  }, [images]);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 0.5;
      controlsRef.current.update();
    }
  });

  const validTextures = textures.filter((t): t is THREE.CanvasTexture => t !== null);

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
        reverseOrbit
      />
      {validTextures.map((tex, i) => {
        const total = validTextures.length;
        const sectorAngle = (Math.PI * 2) / total;
        const overlap = sectorAngle * overlapFraction;
        const startAngle = i * sectorAngle - overlap;
        const sweepAngle = sectorAngle + overlap * 2;

        return (
          <mesh key={i}>
            <sphereGeometry args={[radius, 32, 24, startAngle, sweepAngle, 0, Math.PI]} />
            <meshBasicMaterial map={tex} side={THREE.BackSide} transparent depthWrite={false} />
          </mesh>
        );
      })}
    </>
  );
}

export function SphericalPanoramaViewer({
  images,
  stitchedPanoramaUrl,
  className = "",
}: SphericalPanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [loading, setLoading] = useState(true);

  const useStitched = !!stitchedPanoramaUrl;

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), useStitched ? 800 : 1500);
    return () => clearTimeout(t);
  }, [useStitched, stitchedPanoramaUrl, images.length]);

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
            <p className="text-sm text-white/60">
              {useStitched ? "Loading panorama…" : "Building 360° view…"}
            </p>
          </div>
        </div>
      )}

      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1100, position: [0, 0, 0.1] }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true, alpha: false }}
      >
        {useStitched ? (
          <EquirectangularScene url={stitchedPanoramaUrl!} autoRotate={autoRotate} />
        ) : (
          <SlicedScene images={images} autoRotate={autoRotate} />
        )}
      </Canvas>

      {/* Controls overlay */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/20 bg-black/40 backdrop-blur-sm"
          onClick={() => setAutoRotate(!autoRotate)}
        >
          {autoRotate ? <Pause className="h-4 w-4" /> : <RotateCw className="h-4 w-4" />}
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
        {useStitched ? "AI Panorama — Drag to look around" : "360° View — Drag to look around"}
      </div>
    </div>
  );
}
