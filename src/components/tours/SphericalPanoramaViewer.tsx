import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Maximize, RotateCw, Pause, Minimize } from "lucide-react";
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
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setFadeIn(true);
    const t = setTimeout(() => setFadeIn(false), 600);
    return () => clearTimeout(t);
  }, [stitchedPanoramaUrl]);

  // Auto-hide controls after 3 seconds of inactivity
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [resetHideTimer]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative bg-black ${className}`}
      style={{ touchAction: "none" }}
      onPointerMove={resetHideTimer}
      onPointerDown={resetHideTimer}
    >
      {/* Fade-in overlay */}
      <div
        className="absolute inset-0 z-20 bg-black pointer-events-none transition-opacity duration-500"
        style={{ opacity: fadeIn ? 1 : 0 }}
      />

      <Canvas
        camera={{ fov: 90, near: 0.01, far: 1100, position: [0, 0, 0.1] }}
        style={{ width: "100%", height: "100%" }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
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

      {/* Controls — auto-hide after 3s */}
      <div
        className={`absolute bottom-4 right-4 z-30 flex items-center gap-1 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          onClick={() => { setAutoRotate(!autoRotate); resetHideTimer(); }}
          className="h-9 w-9 flex items-center justify-center text-white/70 hover:text-white bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full transition-all"
        >
          {autoRotate ? <Pause className="h-4 w-4" /> : <RotateCw className="h-4 w-4" />}
        </button>
        <button
          onClick={() => { toggleFullscreen(); resetHideTimer(); }}
          className="h-9 w-9 flex items-center justify-center text-white/70 hover:text-white bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full transition-all"
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>

      {/* Subtle hint — fades out with controls */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-black/40 backdrop-blur-sm text-white/50 px-3 py-1 rounded-full text-[10px] pointer-events-none transition-opacity duration-500 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        Drag to look around
      </div>
    </div>
  );
}
