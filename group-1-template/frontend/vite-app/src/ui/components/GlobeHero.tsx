import React, { useEffect, useRef, useState } from "react";
import Globe from "react-globe.gl";

// --- Globe and Background Only ---
const AnimatedGlobe = () => {
  const globeEl = useRef<any>();
  const [arcsData, setArcsData] = useState<any[]>([]);
  const [ringsData, setRingsData] = useState<any[]>([]);

  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.6;
      globeEl.current.controls().enableZoom = false;
    }

    const N_ARCS = 80;
    const arcs = [...Array(N_ARCS).keys()].map(() => {
        const isDanger = Math.random() > 0.5;
        return {
          startLat: (Math.random() - 0.5) * 160,
          startLng: (Math.random() - 0.5) * 360,
          endLat: (Math.random() - 0.5) * 160,
          endLng: (Math.random() - 0.5) * 360,
          color: isDanger 
            ? ['rgba(239, 68, 68, 1)', 'rgba(239, 68, 68, 0.1)'] 
            : ['rgba(52, 211, 153, 1)', 'rgba(52, 211, 153, 0.1)'],
          dashGap: Math.random() * 2 + 1,
          dashAnimateTime: Math.random() * 1500 + 1500
        };
      });
      setArcsData(arcs);

    const N_RINGS = 30;
    const rings = [...Array(N_RINGS).keys()].map(() => ({
      lat: (Math.random() - 0.5) * 160,
      lng: (Math.random() - 0.5) * 360,
      maxR: Math.random() * 15 + 2,
      propagationSpeed: (Math.random() - 0.5) * 5 + 1,
      repeatPeriod: Math.random() * 2000 + 500,
      type: Math.random() > 0.5 ? 'danger' : 'safe'
    }));
    setRingsData(rings);

  }, []);

  return (
    <Globe
      ref={globeEl}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      atmosphereColor="#3b82f6" 
      atmosphereAltitude={0.15}
      arcsData={arcsData}
      arcColor="color"
      arcDashLength={0.4}
      arcDashGap={(d: any) => d.dashGap} 
      arcDashAnimateTime={(d: any) => d.dashAnimateTime}
      arcStroke={0.6}
      ringsData={ringsData}
      ringColor={(d: any) => (t: any) => 
        d.type === 'danger' ? `rgba(239, 68, 68, ${1 - t})` : `rgba(52, 211, 153, ${1 - t})`
      }
      ringMaxRadius="maxR"
      ringPropagationSpeed="propagationSpeed"
      ringRepeatPeriod="repeatPeriod"
      enableZoom={false}
      width={window.innerWidth}
      height={window.innerHeight}
    />
  );
};

export default function GlobeHero() {
  return (
    <div style={{ position: "relative", height: "100vh", width: "100%", overflow: "hidden", background: "#02040a" }}>
      {/* Stars */}
      <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(2px 2px at 50px 50px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 100px 150px, #fff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 300px 200px, #fff, rgba(0,0,0,0))`,
          backgroundSize: "600px 600px", opacity: 0.4, zIndex: 1
        }}
      />
      {/* Glow */}
      <div style={{
          position: "absolute", top: "50%", left: "50%", width: "60vw", height: "60vw", transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle, rgba(56, 189, 248, 0.12), rgba(0,0,0,0) 65%)", filter: "blur(70px)", zIndex: 2, pointerEvents: "none"
        }}
      />
      {/* Globe */}
      <div style={{ position: "absolute", inset: 0, zIndex: 3, cursor: "default" }}>
        <AnimatedGlobe />
      </div>
      


    </div>
  );
}