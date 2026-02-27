import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { OrbitControls, Html, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Eye, Move3D } from "lucide-react";

interface CameraPose {
  image_id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
  overlap_with_next?: number;
}

interface SceneConfig {
  scene_type: string;
  estimated_width_m: number;
  estimated_depth_m: number;
  camera_height_m: number;
  description: string;
}

interface ImageData {
  id: string;
  original_url: string;
  medium_url?: string | null;
  large_url?: string | null;
}

interface Tour3DViewerProps {
  cameraPoses: CameraPose[];
  sceneConfig: SceneConfig;
  images: ImageData[];
  className?: string;
}

// Single image plane in 3D space
function ImagePlane({
  pose,
  imageUrl,
  index,
  isActive,
  onClick,
}: {
  pose: CameraPose;
  imageUrl: string;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(
      imageUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        setTexture(tex);
      },
      undefined,
      (err) => console.warn("Failed to load texture:", imageUrl, err)
    );
    return () => { texture?.dispose(); };
  }, [imageUrl]);

  // Position the plane where the camera was looking
  const position = useMemo(() => {
    const yawRad = (pose.yaw * Math.PI) / 180;
    const distance = 2; // Place image plane 2m in front of camera
    return new THREE.Vector3(
      pose.x + Math.sin(yawRad) * distance,
      pose.y,
      pose.z - Math.cos(yawRad) * distance
    );
  }, [pose]);

  const rotation = useMemo(() => {
    return new THREE.Euler(
      (pose.pitch * Math.PI) / 180,
      (pose.yaw * Math.PI) / 180 + Math.PI, // Face back toward camera
      (pose.roll * Math.PI) / 180,
      "YXZ"
    );
  }, [pose]);

  // Aspect ratio based on FOV
  const fovRad = ((pose.fov || 60) * Math.PI) / 180;
  const planeHeight = 2 * 2 * Math.tan(fovRad / 2); // 2m distance
  const planeWidth = planeHeight * (16 / 9); // Assume 16:9

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[planeWidth, planeHeight]} />
      {texture ? (
        <meshBasicMaterial
          map={texture}
          side={THREE.DoubleSide}
          transparent
          opacity={isActive ? 1 : hovered ? 0.9 : 0.7}
        />
      ) : (
        <meshBasicMaterial color="#333" side={THREE.DoubleSide} />
      )}
      {/* Glow border when active */}
      {(isActive || hovered) && (
        <lineSegments>
          <edgesGeometry args={[new THREE.PlaneGeometry(planeWidth, planeHeight)]} />
          <lineBasicMaterial color={isActive ? "#3b82f6" : "#ffffff"} linewidth={2} />
        </lineSegments>
      )}
      {/* Label */}
      <Html
        position={[0, planeHeight / 2 + 0.15, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: "none" }}
      >
        <div className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
          isActive ? "bg-blue-500 text-white" : "bg-black/60 text-white/70"
        }`}>
          Photo {index + 1}
        </div>
      </Html>
    </mesh>
  );
}

// Camera position markers
function CameraMarker({ pose, index, isActive }: { pose: CameraPose; index: number; isActive: boolean }) {
  const color = isActive ? "#3b82f6" : "#ffffff";

  return (
    <group position={[pose.x, pose.y, pose.z]}>
      {/* Camera icon (small box) */}
      <mesh>
        <boxGeometry args={[0.15, 0.1, 0.1]} />
        <meshBasicMaterial color={color} transparent opacity={isActive ? 1 : 0.4} />
      </mesh>
      {/* View direction line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              0, 0, 0,
              Math.sin((pose.yaw * Math.PI) / 180) * 0.5,
              0,
              -Math.cos((pose.yaw * Math.PI) / 180) * 0.5,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.6} />
      </line>
    </group>
  );
}

// Camera path line
function CameraPath({ poses }: { poses: CameraPose[] }) {
  const points = useMemo(() => {
    return poses.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  }, [poses]);

  if (points.length < 2) return null;

  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
  const curvePoints = curve.getPoints(50);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={curvePoints.length}
          array={new Float32Array(curvePoints.flatMap((p) => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#3b82f6" transparent opacity={0.3} linewidth={1} />
    </line>
  );
}

// Floor grid
function FloorGrid({ width, depth }: { width: number; depth: number }) {
  return (
    <gridHelper
      args={[Math.max(width, depth) * 2, 20, "#333333", "#1a1a1a"]}
      position={[0, -1.5, 0]}
      rotation={[0, 0, 0]}
    />
  );
}

// Walkthrough animation controller
function WalkthroughController({
  poses,
  isPlaying,
  speed,
  onPoseChange,
}: {
  poses: CameraPose[];
  isPlaying: boolean;
  speed: number;
  onPoseChange: (index: number) => void;
}) {
  const { camera } = useThree();
  const progressRef = useRef(0);

  const points = useMemo(() => {
    return poses.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  }, [poses]);

  const lookPoints = useMemo(() => {
    return poses.map((p) => {
      const yawRad = (p.yaw * Math.PI) / 180;
      return new THREE.Vector3(
        p.x + Math.sin(yawRad) * 2,
        p.y,
        p.z - Math.cos(yawRad) * 2
      );
    });
  }, [poses]);

  useFrame((_, delta) => {
    if (!isPlaying || points.length < 2) return;

    progressRef.current += delta * speed * 0.1;
    if (progressRef.current >= 1) {
      progressRef.current = 0;
    }

    const totalSegments = points.length - 1;
    const segmentProgress = progressRef.current * totalSegments;
    const segmentIndex = Math.min(Math.floor(segmentProgress), totalSegments - 1);
    const t = segmentProgress - segmentIndex;

    // Interpolate position
    const pos = new THREE.Vector3().lerpVectors(points[segmentIndex], points[segmentIndex + 1], t);
    camera.position.copy(pos);

    // Interpolate look target
    const look = new THREE.Vector3().lerpVectors(lookPoints[segmentIndex], lookPoints[segmentIndex + 1], t);
    camera.lookAt(look);

    onPoseChange(segmentIndex);
  });

  return null;
}

export function Tour3DViewer({ cameraPoses, sceneConfig, images, className }: Tour3DViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<"orbit" | "walkthrough">("orbit");

  // Map images to poses
  const imageMap = useMemo(() => {
    const map = new Map<string, ImageData>();
    images.forEach((img) => map.set(img.id, img));
    return map;
  }, [images]);

  const getImageUrl = (imageId: string) => {
    const img = imageMap.get(imageId);
    if (!img) return "";
    return img.large_url || img.medium_url || img.original_url || "";
  };

  // Calculate scene center for orbit
  const sceneCenter = useMemo(() => {
    if (cameraPoses.length === 0) return new THREE.Vector3(0, 0, 0);
    const center = new THREE.Vector3();
    cameraPoses.forEach((p) => center.add(new THREE.Vector3(p.x, p.y, p.z)));
    center.divideScalar(cameraPoses.length);
    return center;
  }, [cameraPoses]);

  const resetView = () => {
    setActiveIndex(0);
    setIsPlaying(false);
  };

  return (
    <div className={`relative bg-black ${className || "flex-1"}`}>
      <Canvas
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#0a0a0a"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.3} />

        <Suspense fallback={null}>
          {/* Image planes */}
          {cameraPoses.map((pose, idx) => (
            <ImagePlane
              key={pose.image_id}
              pose={pose}
              imageUrl={getImageUrl(pose.image_id)}
              index={idx}
              isActive={idx === activeIndex}
              onClick={() => setActiveIndex(idx)}
            />
          ))}

          {/* Camera markers */}
          {cameraPoses.map((pose, idx) => (
            <CameraMarker key={`cam-${pose.image_id}`} pose={pose} index={idx} isActive={idx === activeIndex} />
          ))}

          {/* Camera path */}
          <CameraPath poses={cameraPoses} />

          {/* Floor */}
          <FloorGrid
            width={sceneConfig.estimated_width_m || 10}
            depth={sceneConfig.estimated_depth_m || 10}
          />
        </Suspense>

        {/* Camera controls */}
        {viewMode === "orbit" && (
          <>
            <PerspectiveCamera
              makeDefault
              position={[sceneCenter.x, sceneCenter.y + 3, sceneCenter.z + 8]}
              fov={60}
            />
            <OrbitControls
              target={[sceneCenter.x, sceneCenter.y, sceneCenter.z]}
              enableDamping
              dampingFactor={0.05}
              minDistance={1}
              maxDistance={30}
            />
          </>
        )}

        {viewMode === "walkthrough" && (
          <WalkthroughController
            poses={cameraPoses}
            isPlaying={isPlaying}
            speed={1}
            onPoseChange={setActiveIndex}
          />
        )}
      </Canvas>

      {/* Controls overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 text-xs gap-1.5 ${viewMode === "orbit" ? "text-blue-400 bg-white/10" : "text-white/60 hover:text-white"}`}
          onClick={() => { setViewMode("orbit"); setIsPlaying(false); }}
        >
          <Eye className="h-3.5 w-3.5" />
          Orbit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 text-xs gap-1.5 ${viewMode === "walkthrough" ? "text-blue-400 bg-white/10" : "text-white/60 hover:text-white"}`}
          onClick={() => setViewMode("walkthrough")}
        >
          <Move3D className="h-3.5 w-3.5" />
          Walk
        </Button>

        <div className="w-px h-5 bg-white/20" />

        {viewMode === "walkthrough" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/60 hover:text-white"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/60 hover:text-white"
          onClick={resetView}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Scene info */}
      <div className="absolute top-4 left-4 z-30 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 max-w-xs">
        <p className="text-white/80 text-xs font-medium">{sceneConfig.description || "3D Reconstruction"}</p>
        <p className="text-white/40 text-[10px] mt-0.5">
          {cameraPoses.length} viewpoints • {sceneConfig.scene_type || "space"}
        </p>
      </div>

      {/* Active photo indicator */}
      <div className="absolute top-4 right-4 z-30 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
        <p className="text-white/80 text-xs">Photo {activeIndex + 1} of {cameraPoses.length}</p>
      </div>
    </div>
  );
}
