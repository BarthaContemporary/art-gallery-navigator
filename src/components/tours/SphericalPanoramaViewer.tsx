import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Maximize, RotateCw, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SphericalPanoramaViewerProps {
  stitchedPanoramaUrl: string;
  className?: string;
}

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

export function SphericalPanoramaViewer({
  stitchedPanoramaUrl,
  className = "",
}: SphericalPanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, [stitchedPanoramaUrl]);

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
            <p className="text-sm text-white/60">Loading panorama…</p>
          </div>
        </div>
      )}

      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1100, position: [0, 0, 0.1] }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true, alpha: false }}
      >
        <EquirectangularScene url={stitchedPanoramaUrl} autoRotate={autoRotate} />
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
        AI Panorama — Drag to look around
      </div>
    </div>
  );
}
