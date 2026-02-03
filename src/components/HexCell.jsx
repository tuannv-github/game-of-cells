
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';

const HexCell = ({ position, type, active, onClick, serviceRadius, shouldBeOn = false, isGameOver = false, showCoverage = false }) => {
    const meshRef = useRef();

    const hexShape = useMemo(() => {
        const shape = new THREE.Shape();
        const sides = 6;
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const x = Math.cos(angle) * serviceRadius;
            const y = Math.sin(angle) * serviceRadius;
            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();
        return shape;
    }, [serviceRadius]);

    // Determine color based on state
    const getColor = () => {
        // If game is over and cell should be on but isn't, show red
        if (isGameOver && shouldBeOn && !active) {
            return '#ff0000'; // Red for missing coverage
        }

        // Normal colors
        if (active) {
            return type === 'capacity' ? '#00ff66' : '#4db8ff';
        } else {
            return type === 'capacity' ? '#2a4d3a' : '#30475e';
        }
    };

    const color = getColor();

    return (
        <group position={position}>
            {/* Main Cell Body */}
            <mesh
                rotation={[-Math.PI / 2, 0, Math.PI / 6]}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                ref={meshRef}
            >
                <extrudeGeometry args={[hexShape, { depth: 0.05, bevelEnabled: false }]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={active || (isGameOver && shouldBeOn && !active) ? 1.5 : 0.5}
                    transparent={!active && !(isGameOver && shouldBeOn)}
                    opacity={(active || (isGameOver && shouldBeOn && !active)) ? 1.0 : 0.8}
                    metalness={0.8}
                    roughness={0.2}
                />
            </mesh>

            {/* Cell Border/Outline */}
            <lineSegments rotation={[-Math.PI / 2, 0, Math.PI / 6]} position={[0, 0.03, 0]}>
                <edgesGeometry args={[new THREE.ExtrudeGeometry(hexShape, { depth: 0.05, bevelEnabled: false })]} />
                <lineBasicMaterial color={active ? "white" : "#ffffff"} transparent opacity={active ? 0.8 : 0.3} />
            </lineSegments>

            {/* Coverage Boundary (Visible if active or explicitly requested) */}
            {(showCoverage || active) && (
                <mesh rotation={[-Math.PI / 2, 0, Math.PI / 6]} position={[0, -0.05, 0]}>
                    <ringGeometry args={[serviceRadius - 0.5, serviceRadius, 6]} />
                    <meshBasicMaterial
                        color={color}
                        transparent
                        opacity={0.3}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
        </group>
    );
};

// Simplified coordinate helper
export const getHexPosition = (q, r, radius) => {
    const x = radius * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const y = radius * (1.5 * r);
    return [x, 0, y];
};

export default HexCell;
