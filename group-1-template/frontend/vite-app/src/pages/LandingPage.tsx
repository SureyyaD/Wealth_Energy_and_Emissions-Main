import { useState } from "react";
import { Link } from "react-router-dom";
import GlobeHero from "../ui/components/GlobeHero";
import droughtImg from "../assets/drought_index.png";
import wildfireImg from "../assets/wildfires.png";
import renewableImg from "../assets/renewableShare.png";
import sideBySideImg from "../assets/side_by_side.png";

// --- SCROLL BUTTON ---
const ScrollButton = () => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={() => window.scrollBy({ top: window.innerHeight, behavior: "smooth" })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "absolute",
        bottom: "60px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        cursor: "pointer",
        width: "75px",
        height: "75px",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isHovered 
          ? "rgba(16, 185, 129, 0.15)" 
          : "rgba(255, 255, 255, 0.03)",
        border: isHovered
          ? "3px solid #34d399"
          : "3px solid rgba(52, 211, 153, 0.4)",
        boxShadow: isHovered 
          ? "0 0 25px rgba(52, 211, 153, 0.5), inset 0 0 10px rgba(52, 211, 153, 0.2)" 
          : "0 0 10px rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(6px)",
        transition: "all 0.4s ease",
        animation: isHovered ? "none" : "softPulse 3s infinite ease-in-out"
      }}
    >
      <span style={{ 
          fontSize: "1.8rem", 
          fontWeight: "300",
          color: isHovered ? "#ffffff" : "#f0fdf4",
          display: "block",
          transition: "transform 0.3s ease, color 0.3s ease",
          transform: isHovered ? "translateY(3px)" : "translateY(0)",
          textShadow: isHovered ? "0 0 10px rgba(255, 255, 255, 0.6)" : "none"
      }}>
        ↓
      </span>
      <style>
        {`
          @keyframes softPulse {
            0% { box-shadow: 0 0 0px rgba(52, 211, 153, 0); border-color: rgba(52, 211, 153, 0.3); transform: translateX(-50%) translateY(0); }
            50% { box-shadow: 0 0 15px rgba(52, 211, 153, 0.3); border-color: rgba(52, 211, 153, 0.6); transform: translateX(-50%) translateY(-6px); }
            100% { box-shadow: 0 0 0px rgba(52, 211, 153, 0); border-color: rgba(52, 211, 153, 0.3); transform: translateX(-50%) translateY(0); }
          }
        `}
      </style>
    </div>
  );
};

// --- USE CASE CARD ---
const UseCaseCard = ({ uc }: { uc: any }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <Link
      to={`/usecases/${uc.id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        minHeight: "320px",
        padding: "3rem",
        borderRadius: "16px",
        textDecoration: "none",
        backgroundColor: isHovered ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.03)",
        border: isHovered ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(12px)",
        display: "flex", flexDirection: "column", gap: "0.8rem",
        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        transform: isHovered ? "translateY(-8px)" : "translateY(0)",
        boxShadow: isHovered ? "0 20px 40px -10px rgba(16, 185, 129, 0.2)" : "none",
        cursor: "pointer", position: "relative", overflow: "hidden"
      }}
    >
      <div style={{ fontSize: "1.3rem", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, color: "#34d399", marginBottom: "0.5rem" }}>
        Analysis
      </div>
      <h3 style={{ margin: 0, fontSize: "2rem", fontWeight: 600, color: "#f0fdf4" }}>{uc.title}</h3>
      <p style={{ margin: 0, fontSize: "1.2rem", lineHeight: 1.6, color: "#94a3b8" }}>{uc.description}</p>
      {isHovered && (<div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle, rgba(52,211,153,0.1) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />)}
    </Link>
  );
};

export default function LandingPage() {
  const useCases = [
    { id: 1, title: "Drought Index", description: "Track regional drought severity to support sustainable water management." },
    { id: 2, title: "Wildfires", description: "Analyze wildfire risk, hotspots and historical patterns to protect ecosystems." },
    { id: 3, title: "Renewable Share", description: "Monitor the share of renewable energy in the power mix over time." }
  ];

  return (
    <div style={{ width: "100%", minHeight: "100vh", overflowX: "hidden", backgroundColor: "#02040a", display: "flex", flexDirection: "column" }}>
      
      {/* --- HERO SECTION --- */}
      <div style={{ height: "100vh", width: "100%", position: "relative" }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            <GlobeHero />
        </div>
        <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, #02040a 0%, rgba(2,4,10,0.5) 45%, transparent 100%)',
            zIndex: 2, pointerEvents: 'none'
        }} />
        <div style={{ position: "absolute", top: "50%", left: "8%", transform: "translateY(-50%)", zIndex: 10, maxWidth: "900px", padding: "2rem", pointerEvents: "none" }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: '30px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#7dd3fc', fontSize: '0.8rem', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '1.5rem', backdropFilter: 'blur(4px)', boxShadow: '0 0 15px rgba(56, 189, 248, 0.2)' }}>
            PLANETARY INTELLIGENCE
          </div>
          <h1 style={{ fontSize: "10rem", margin: 0, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.03em", color: "white", textShadow: "0 0 40px rgba(0,0,0,0.5)" }}>
            Decoding <br/>
            <span style={{ background: "linear-gradient(to right, #4ade80, #22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Earth's Signals.</span>
          </h1>
          <p style={{ fontSize: "2rem", marginTop: "4rem", lineHeight: 1.6, color: "#cbd5e1", maxWidth: "900px", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
            Visualize real-time environmental data. From wildfire patterns to energy shifts, we turn raw planetary data into actionable insights for a resilient future.
          </p>
        </div>
        <div style={{
            position: 'absolute', bottom: 0, left: 0, width: '100%', height: '250px',
            background: 'linear-gradient(to bottom, transparent, #02040a)',
            zIndex: 5, pointerEvents: 'none'
        }} />
        <ScrollButton />
      </div>

      {/* --- USE CASES SECTION --- */}
      <div style={{ padding: "4rem 2rem 8rem 2rem", background: "linear-gradient(180deg, #02040a 0%, #0f172a 20%, #083344 100%)", position: "relative", zIndex: 10 }}>
        <section style={{ maxWidth: "1600px", margin: "0 auto" }}>
          <div style={{ marginBottom: "3rem", textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "2.5rem", fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>Explore Dimensions</h2>
            <div style={{ width: '60px', height: '4px', background: '#34d399', margin: '1rem auto', borderRadius: '2px' }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" }}>
            {useCases.map((uc) => (
              <UseCaseCard key={uc.id} uc={uc} />
            ))}
          </div>
        </section>
      </div>

      {/* --- ANALYSIS INTRO SECTION (UPDATED IMAGE) --- */}
      <div
        style={{
          padding: "8rem 2rem",
          background: "radial-gradient(circle at top, rgba(34, 211, 238, 0.12), #020617 60%)",
        }}
      >
        <section
          style={{
            maxWidth: "1600px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4rem",
            alignItems: "center",
          }}
        >
          {/* LEFT TEXT */}
          <div>
            <div
              style={{
                display: "inline-block",
                padding: "6px 14px",
                borderRadius: "999px",
                background: "rgba(34, 211, 238, 0.15)",
                border: "1px solid rgba(34, 211, 238, 0.4)",
                color: "#22d3ee",
                fontSize: "0.75rem",
                letterSpacing: "0.12em",
                fontWeight: 700,
                marginBottom: "1.5rem",
              }}
            >
              SIDE-BY-SIDE ANALYSIS
            </div>

            <h2 style={{ fontSize: "2.6rem", color: "#ecfeff", marginBottom: "1rem" }}>
              Compare planetary signals in with others
            </h2>

            <p style={{ color: "#a5f3fc", fontSize: "1.3rem", lineHeight: 1.7 }}>
              Our platform allows you to analyze multiple environmental dimensions
              simultaneously. Detect correlations between drought, wildfire risk and
              renewable energy shifts in a single unified view.
            </p>
            <Link
              to="/compare/drought"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.6rem",
                marginTop: "2.2rem",
                padding: "0.9rem 1.6rem",
                borderRadius: "999px",
                textDecoration: "none",
                background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
                color: "#02040a",
                fontWeight: 700,
                fontSize: "0.95rem",
                letterSpacing: "0.04em",
                boxShadow: "0 0 30px rgba(34,211,238,0.4)",
                border: "1px solid rgba(255,255,255,0.3)",
                transition: "all 0.35s ease",
              }}
            >
              Start Side-by-Side Analysis →
            </Link>
          </div>

          {/* RIGHT VISUAL - ATMOSPHERIC GLASS EFFECT ADDED */}
          <div
            style={{
              position: "relative",
              height: "380px", // Increased height for padding
              borderRadius: "24px",
              padding: "12px", // Glass frame padding
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(34, 211, 238, 0.2)",
              boxShadow: "0 20px 50px -10px rgba(0,0,0,0.5)",
              backdropFilter: "blur(10px)",
            }}
          >
            {/* Background Glow */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '80%', height: '80%',
                background: 'rgba(34, 211, 238, 0.25)',
                filter: 'blur(80px)',
                zIndex: 0, pointerEvents: 'none'
            }} />

            {/* Inner Container */}
            <div style={{
                position: 'relative', width: '100%', height: '100%',
                borderRadius: '16px', overflow: 'hidden', zIndex: 1,
                background: '#0f172a' // Fallback dark bg
            }}>
                {/* Vignette (Inner Shadow) to blend edges */}
                <div style={{
                    position: 'absolute', inset: 0,
                    boxShadow: 'inset 0 0 60px rgba(2, 4, 10, 0.6)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    pointerEvents: 'none', zIndex: 2
                }} />

                <img
                  src={sideBySideImg}
                  alt="Side-by-side analysis preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: "brightness(0.95) contrast(1.1)"
                  }}
                />
            </div>
          </div>
        </section>
      </div>

      {/* --- STORYLINE DIMENSION HIGHLIGHTS --- */}
      <div
        style={{
          padding: "10rem 2rem",
          background: "#02040a", 
          borderTop: "1px solid rgba(34, 211, 238, 0.15)",
          boxShadow: "inset 0 30px 60px -20px rgba(34, 211, 238, 0.08)",
          position: "relative"
        }}
      >
        <div style={{
           position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)',
           width: '30%', height: '1px',
           background: 'linear-gradient(90deg, transparent, #22d3ee, transparent)',
           boxShadow: '0 0 15px rgba(34, 211, 238, 0.5)'
        }} />

        <section style={{ maxWidth: "1600px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "6rem" }}>
            <h2 style={{ fontSize: "2.8rem", color: "#f8fafc" }}>
              From Signals to Insights
            </h2>
            <p style={{ color: "#94a3b8", maxWidth: "640px", margin: "1.5rem auto", fontSize:"1.3rem"}}>
              Every dimension tells a story — together they reveal the future of our planet.
            </p>
          </div>

          {[
            {
              id: "01",
              title: "Drought Index",
              insight: "High agricultural efficiency under extreme constraints. Despite using only 5 % of its land for agriculture, Oman achieves 29.15 t/ha crop yields and covers around 50 % of its domestic food demand, even under drought conditions.",
              description: "Oman’s high crop yields are the result of necessity-driven efficiency rather than abundant resources. With only 5 % of its territory suitable for agriculture, the country focuses on maximizing output per hectare, allowing it to meet approximately half of its domestic food demand despite persistent drought conditions.",
              color: "#22d3ee", // Cyan
              colorRgb: "34, 211, 238",
              colorLight: "#a7f3d0",
            },
            {
              id: "02",
              title: "Wildfire Risk",
              insight: "High-risk wildfire corridors have expanded by over 23% across Mediterranean regions since 2015.",
              description: "Temperature anomalies, wind patterns and vegetation dryness are combined into a predictive wildfire susceptibility model.",
              color: "#f59e0b", // Amber
              colorRgb: "245, 158, 11",
              colorLight: "#fcd34d",
            },
            {
              id: "03",
              title: "Renewable Share",
              insight: "High renewable penetration is not exclusive to wealthy economies. Tajikistan demonstrates how geographical assets—specifically hydropower—can drive clean energy adoption independently of GDP.",
              description: "Visual analysis demonstrates that while wealth drives technology, geography drives capacity. In regions like Central Asia, abundant natural hydropower resources enable a sustainable energy mix.",
              color: "#10b981", // Emerald
              colorRgb: "16, 185, 129",
              colorLight: "#6ee7b7",
            },
          ].map((item, i) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: i % 2 === 0 ? "1.2fr 1fr" : "1fr 1.2fr",
                gap: "3rem",
                alignItems: "center",
                marginBottom: "7rem",
              }}
            >
              {/* TEXT SIDE */}
              <div style={{ order: i % 2 === 0 ? 1 : 2 }}>
                <div style={{ fontSize: "1.2rem", color: item.color, fontWeight: 700, letterSpacing: "0.15em", marginBottom: "0.8rem" }}>
                  INSIGHT {item.id}
                </div>
                <h3 style={{ fontSize: "2.5rem", color: "#ecfdf5", marginBottom: "1rem", position: "relative", paddingBottom: "0.5rem" }}>
                  {item.title}
                  <div style={{ position: "absolute", bottom: 0, left: 0, width: "60px", height: "3px", background: item.color, borderRadius: "2px" }} />
                </h3>
                <div style={{
                    padding: "1rem 1.2rem",
                    borderLeft: `4px solid ${item.color}`,
                    background: `linear-gradient(90deg, rgba(${item.colorRgb}, 0.15) 0%, rgba(${item.colorRgb}, 0.0) 100%)`,
                    backdropFilter: "blur(5px)",
                    color: item.colorLight,
                    marginBottom: "1.5rem",
                    fontSize: "1.3rem",
                    lineHeight: 1.6,
                  }}>
                  {item.insight}
               </div>
                <p style={{ color: "#94a3b8", lineHeight: 1.7, fontSize:"1.2rem"}}>
                  {item.description}
                </p>
              </div>

              {/* VISUAL SIDE - UPDATED WITH ATMOSPHERIC GLASS */}
              <div
                style={{
                  order: i % 2 === 0 ? 2 : 1,
                  height: "360px",
                  position: "relative",
                  padding: "12px",
                  borderRadius: "24px",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: `1px solid rgba(${item.colorRgb}, 0.25)`,
                  backdropFilter: "blur(12px)",
                  boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.6)`,
                }}
              >
                {/* 1. Dynamic Background Glow */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: `radial-gradient(circle at center, rgba(${item.colorRgb}, 0.15) 0%, transparent 70%)`,
                    filter: 'blur(40px)',
                    zIndex: 0
                }} />

                {/* 2. Image Container */}
                <div style={{
                    position: 'relative', width: '100%', height: '100%',
                    borderRadius: '16px', overflow: 'hidden', zIndex: 1,
                    background: '#0f172a'
                }}>
                    {/* 3. Vignette (Shadow Gradient) */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        boxShadow: 'inset 0 0 50px rgba(2, 4, 10, 0.6)',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        pointerEvents: 'none', zIndex: 10
                    }} />

                    <img
                      src={item.id === "01" ? droughtImg : item.id === "02" ? wildfireImg : renewableImg}
                      alt={item.title}
                      style={{
                        width: "100%", height: "100%", objectFit: "cover",
                        filter: "contrast(1.05) saturate(1.1) brightness(0.95)",
                        transform: "scale(1.01)"
                      }}
                    />
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}