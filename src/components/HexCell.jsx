import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const HexCell = ({ position, type, active, onClick, serviceRadius }) => {
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

    return (
        <group position={position}>
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
                    color={active
                        ? (type === 'capacity' ? '#00ff66' : '#4db8ff')
                        : (type === 'capacity' ? '#2a4d3a' : '#30475e')}
                    emissive={active
                        ? (type === 'capacity' ? '#00ff66' : '#4db8ff')
                        : (type === 'capacity' ? '#2a4d3a' : '#30475e')}
                    emissiveIntensity={active ? 1.5 : 0.5}
                    transparent={!active}
                    opacity={active ? 1.0 : 0.8}
                />
            </mesh>
            {/* Cell Border/Outline */}
            <lineSegments rotation={[-Math.PI / 2, 0, Math.PI / 6]} position={[0, 0.03, 0]}>
                <edgesGeometry args={[new THREE.ExtrudeGeometry(hexShape, { depth: 0.05, bevelEnabled: false })]} />
                <lineBasicMaterial color={active ? "white" : "#ffffff"} transparent opacity={active ? 0.8 : 0.3} />
            </lineSegments>
        </group>
    );
};

// Simplified coordinate helper
export const getHexPosition = (q, r, radius) => {
    const x = radius * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
    const y = radius * (1.5 * r);
    return [x, 0, y];
};

export default HexCell;
