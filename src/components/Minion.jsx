import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import { Text, Float } from '@react-three/drei';
import * as THREE from 'three';

const TRAIL_SEGMENTS = 12;

// Spring config: meteor-like (fast start, smooth deceleration, no bounce)
const METEOR_CONFIG = { mass: 1, tension: 180, friction: 24, precision: 0.0001 };

const Minion = ({ position, type, color, label, size = 1.0, isUncovered = false, maxMove = 6, showRange = true, currentStep = 0 }) => {
    const meshRef = useRef();
    const groupRef = useRef();
    const startPos = useRef(new THREE.Vector3(position[0], position[1], position[2]));
    const isMoving = useRef(false);

    const [springs, api] = useSpring(
        () => ({
            position: [position[0], position[1], position[2]],
            config: METEOR_CONFIG,
            onRest: () => { isMoving.current = false; },
        }),
        []
    );

    useEffect(() => {
        const [x, y, z] = position;
        const dist = Math.hypot(x - startPos.current.x, y - startPos.current.y, z - startPos.current.z);
        const isRestart = currentStep === 0;
        if (isRestart || dist <= 0.01) {
            isMoving.current = false;
            startPos.current.set(x, y, z);
            api.start({ position: [x, y, z], immediate: true });
        } else {
            isMoving.current = true;
            startPos.current.set(springs.position.get()[0], springs.position.get()[1], springs.position.get()[2]);
            api.start({ position: [x, y, z] });
        }
    }, [position[0], position[1], position[2], currentStep, api]);

    const trailLineRef = useRef();
    const trailPoints = useMemo(() => new Float32Array((TRAIL_SEGMENTS + 1) * 3), []);

    // Clear trail on restart (currentStep resets to 0)
    useEffect(() => {
        if (currentStep === 0) {
            isMoving.current = false;
            trailPoints.fill(0);
            if (trailLineRef.current?.geometry) {
                trailLineRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(trailPoints, 3));
                trailLineRef.current.geometry.attributes.position.needsUpdate = true;
            }
        }
    }, [currentStep]);

    useFrame(() => {
        const g = groupRef.current;
        if (!g || !isMoving.current) return;

        const [sx, sy, sz] = springs.position.get();
        const curr = new THREE.Vector3(sx, sy, sz);
        const back = new THREE.Vector3().subVectors(startPos.current, curr);

        if (back.lengthSq() < 0.0001) return;

        for (let i = 0; i <= TRAIL_SEGMENTS; i++) {
            const f = i / TRAIL_SEGMENTS;
            const pt = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0), back, f);
            trailPoints[i * 3] = pt.x;
            trailPoints[i * 3 + 1] = pt.y;
            trailPoints[i * 3 + 2] = pt.z;
        }
        if (trailLineRef.current?.geometry) {
            trailLineRef.current.geometry.setAttribute('position', new THREE.BufferAttribute(trailPoints, 3));
            trailLineRef.current.geometry.attributes.position.needsUpdate = true;
        }
    });

    useFrame((state) => {
        const clock = state.clock.elapsedTime;

        if (meshRef.current) {
            meshRef.current.position.y = Math.sin(clock * 2) * 0.1;

            const mat = meshRef.current.material;
            if (mat) {
                if (isUncovered) {
                    const t = clock * Math.PI * 2;
                    const isRed = Math.sin(t) > 0;
                    const blinkColor = isRed ? '#ff0000' : color;
                    mat.color.set(blinkColor);
                    mat.emissive.set(blinkColor);
                    mat.emissiveIntensity = isRed ? 3.0 : 1.0;
                } else if (isMoving.current) {
                    mat.color.set(color);
                    mat.emissive.set(color);
                    mat.emissiveIntensity = 2.0;
                } else {
                    mat.color.set(color);
                    mat.emissive.set(color);
                    mat.emissiveIntensity = 0.5;
                }
            }
        }
    });

    return (
        <animated.group ref={groupRef} position={springs.position}>
            {/* Meteor trail (visible when moving) */}
            <line ref={trailLineRef}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={TRAIL_SEGMENTS + 1}
                        array={trailPoints}
                        itemSize={3}
                    />
                </bufferGeometry>
                <lineBasicMaterial color={color} transparent opacity={0.85} />
            </line>
            {showRange && (
                <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[maxMove * 0.85, maxMove, 64]} />
                    <meshBasicMaterial
                        color={color}
                        transparent
                        opacity={0.55}
                        side={THREE.DoubleSide}
                        depthTest={false}
                        depthWrite={false}
                    />
                </mesh>
            )}
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                <mesh ref={meshRef}>
                    {type === 'humanoid' && <boxGeometry args={[size * 1.2, size * 1.2, size * 0.8]} />}
                    {type === 'dog_robot' && <coneGeometry args={[size * 0.8, size * 1.4, 8]} />}
                    {type === 'turtle_bot' && <cylinderGeometry args={[size * 0.9, size * 0.9, size * 0.4, 16]} />}
                    {type === 'drone' && <octahedronGeometry args={[size]} />}
                    {(!type || type === 'human') && <sphereGeometry args={[size * 0.8]} />}
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
                color={isUncovered ? '#ff0000' : 'white'}
                anchorX="center"
                anchorY="middle"
            >
                {label}
            </Text>
        </animated.group>
    );
};

export default Minion;
