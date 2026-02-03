import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float } from '@react-three/drei';

const Minion = ({ position, type, color, label, size = 1.0, isUncovered = false }) => {
    const meshRef = useRef();

    React.useEffect(() => {
        // remoteLog(`[DEBUG] Minion ${label} rendered with size: ${size}, type: ${type}`);
    }, [size, type, label]);

    useFrame((state) => {
        if (meshRef.current) {
            // Subtle hovering animation (relative to the group)
            meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;

            // Blinking logic for uncovered state
            const mat = meshRef.current.material;
            if (mat) {
                if (isUncovered) {
                    const t = state.clock.elapsedTime * Math.PI * 2; // 1 blink per second
                    const isRed = Math.sin(t) > 0;
                    const blinkColor = isRed ? '#ff0000' : '#000000';
                    mat.color.set(blinkColor);
                    mat.emissive.set(blinkColor);
                    mat.emissiveIntensity = 2.0;
                } else {
                    // Reset to normal properties
                    mat.color.set(color);
                    mat.emissive.set(color);
                    mat.emissiveIntensity = 0.5;
                }
            }
        }
    });

    return (
        <group position={position}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                <mesh ref={meshRef}>
                    {type === 'drone' ? (
                        <octahedronGeometry args={[size]} />
                    ) : (
                        <sphereGeometry args={[size * 0.8]} />
                    )}
                    <meshStandardMaterial
                        color={color}
                        emissive={color}
                        emissiveIntensity={0.5}
                        metalness={0.8}
                        roughness={0.2}
                    />
                </mesh>
            </Float>

            <Text
                position={[0, size * 1.5, 0]}
                fontSize={size * 0.6}
                color={isUncovered ? "#ff0000" : "white"}
                anchorX="center"
                anchorY="middle"
            >
                {label}
            </Text>
        </group>
    );
};

export default Minion;
