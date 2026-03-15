import { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface TourHotspot3DProps {
  yaw: number;
  pitch: number;
  label?: string | null;
  targetNodeId: string;
  onNavigate: (targetNodeId: string) => void;
}

/**
 * 3D hotspot rendered inside the panorama sphere.
 * Uses yaw/pitch to position on the sphere interior.
 * Renders as a pulsing ring sprite with optional label on hover.
 */
export function TourHotspot3D({ yaw, pitch, label, targetNodeId, onNavigate }: TourHotspot3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Convert yaw/pitch (degrees) to 3D position on the sphere interior
  const position = useMemo(() => {
    const radius = 480; // slightly inside the 500-radius sphere
    const yawRad = THREE.MathUtils.degToRad(yaw);
    const pitchRad = THREE.MathUtils.degToRad(pitch);
    const x = radius * Math.cos(pitchRad) * Math.sin(yawRad);
    const y = radius * Math.sin(pitchRad);
    const z = radius * Math.cos(pitchRad) * Math.cos(yawRad);
    return new THREE.Vector3(x, y, -z);
  }, [yaw, pitch]);

  // Create ring texture
  const texture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Outer ring
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner filled circle
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fill();

    // Arrow (chevron right)
    ctx.beginPath();
    ctx.moveTo(size * 0.4, size * 0.35);
    ctx.lineTo(size * 0.6, size * 0.5);
    ctx.lineTo(size * 0.4, size * 0.65);
    ctx.strokeStyle = "rgba(255, 255, 255, 1)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  // Pulse animation
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 2) * 0.08;
      const scale = hovered ? 1.3 : pulse;
      groupRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <sprite
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(targetNodeId);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
        scale={[30, 30, 1]}
      >
        <spriteMaterial
          map={texture}
          transparent
          opacity={hovered ? 1 : 0.8}
          depthTest={false}
          sizeAttenuation={false}
        />
      </sprite>

      {hovered && label && (
        <Html
          center
          style={{
            pointerEvents: "none",
            transform: "translateY(-30px)",
          }}
        >
          <div className="whitespace-nowrap bg-black/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full shadow-lg border border-white/20">
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}
