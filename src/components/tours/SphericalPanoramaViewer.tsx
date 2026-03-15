import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Maximize, RotateCw, Pause } from "lucide-react";
import { TourHotspot3D } from "./TourHotspot3D";

interface Hotspot {
  id: string;
  target_node_id: string;
  yaw: number;
  pitch: number;
  label: string | null;
}

interface SphericalPanoramaViewerProps {
  stitchedPanoramaUrl: string;
  className?: string;
  hotspots?: Hotspot[];
  onHotspotClick?: (targetNodeId: string) => void;
  initialHeading?: number | null;
}

function EquirectangularScene({
  url,
  autoRotate,
  hotspots = [],
  onHotspotClick,
  initialHeading,
}: {
  url: string;
  autoRotate: boolean;
  hotspots: Hotspot[];
  onHotspotClick?: (targetNodeId: string) => void;
  initialHeading?: number | null;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const controlsRef = useRef<any>(null);
  const initialHeadingApplied = useRef(false);
  const { gl } = useThree();

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.mapping = THREE.EquirectangularReflectionMapping;
        // Enable high-quality filtering without exceeding device GPU limits
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
        setTexture(tex);
      },
      undefined,
      (err) => console.error("Failed to load panorama texture:", err)
    );
    initialHeadingApplied.current = false;
  }, [url]);

  useEffect(() => {
    if (controlsRef.current && initialHeading != null && !initialHeadingApplied.current && texture) {
      const azimuth = THREE.MathUtils.degToRad(initialHeading);
      controlsRef.current.setAzimuthalAngle(azimuth);
      controlsRef.current.update();
      initialHeadingApplied.current = true;
    }
  }, [initialHeading, texture]);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 0.4;
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
        minDistance={0.1}
        maxDistance={1.4}
        rotateSpeed={-0.26}
        zoomSpeed={0.6}
        enableDamping
        dampingFactor={0.08}
        reverseOrbit
      />
      {/* High-resolution sphere: 128×64 segments for smooth HD rendering */}
      <mesh>
        <sphereGeometry args={[500, 128, 64]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} />
      </mesh>

      {hotspots.map((hs) => (
        <TourHotspot3D
          key={hs.id}
          yaw={hs.yaw}
          pitch={hs.pitch}
          label={hs.label}
          targetNodeId={hs.target_node_id}
          onNavigate={(id) => onHotspotClick?.(id)}
        />
      ))}
    </>
  );
}

export function SphericalPanoramaViewer({
  stitchedPanoramaUrl,
  className = "",
  hotspots = [],
  onHotspotClick,
  initialHeading,
}: SphericalPanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [fadeIn, setFadeIn] = useState(true);

  useEffect(() => {
    setFadeIn(true);
    const t = setTimeout(() => setFadeIn(false), 600);
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
      {/* Fade-in overlay */}
      <div
        className="absolute inset-0 z-20 bg-black pointer-events-none transition-opacity duration-500"
        style={{ opacity: fadeIn ? 1 : 0 }}
      />

      <Canvas
        camera={{ fov: 92, near: 0.01, far: 1100, position: [0, 0, 0.1] }}
        style={{ width: "100%", height: "100%" }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          // Request higher pixel ratio for crisp rendering
        }}
        dpr={[1, 2]}
      >
        <EquirectangularScene
          url={stitchedPanoramaUrl}
          autoRotate={autoRotate}
          hotspots={hotspots}
          onHotspotClick={onHotspotClick}
          initialHeading={initialHeading}
        />
      </Canvas>

      {/* Minimal floating controls — bottom right */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1">
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className="h-8 w-8 flex items-center justify-center text-white/60 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full transition-all"
        >
          {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <RotateCw className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={toggleFullscreen}
          className="h-8 w-8 flex items-center justify-center text-white/60 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full transition-all"
        >
          <Maximize className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Subtle hint badge */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-black/40 backdrop-blur-sm text-white/50 px-3 py-1 rounded-full text-[10px] pointer-events-none">
        Drag to look around
      </div>
    </div>
  );
}
