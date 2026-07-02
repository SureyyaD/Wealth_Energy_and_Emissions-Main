import { useEffect, useRef } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

export default function AnimatedGlobe() {
    const globeRef = useRef<any>(null);

    useEffect(() => {
        const globe = globeRef.current;
        if (!globe) return;

        // Smooth auto-rotation
        globe.controls().autoRotate = true;
        globe.controls().autoRotateSpeed = 0.6;

        // Optional Atmosphere color tweak
        globe.scene().children[0].material.color = new THREE.Color("#2a8cff");
    }, []);

    return (
        <div style={{ width: "100%", height: "100%" }}>
            <Globe
                ref={globeRef}
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                backgroundColor="rgba(0,0,0,0)"
                animateIn={true}
            />
        </div>
    );
}
