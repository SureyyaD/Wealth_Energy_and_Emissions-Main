import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import React,{ useState, useEffect } from "react";

const THEMES = {
  drought: "/usecases/1",
  wildfire: "/usecases/2",
  renewable: "/usecases/3",
} as const;

type ThemeKey = keyof typeof THEMES;

function ThemeSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ThemeKey;
  onChange: (v: ThemeKey) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ThemeKey)}
        style={{
          padding: "0.45rem 0.75rem",
          borderRadius: "999px",
          border: "1px solid rgba(52,211,153,0.4)",
          background: "rgba(16,185,129,0.1)",
          color: "#ecfdf5",
          fontSize: "0.75rem",
          letterSpacing: "0.05em",
          outline: "none",
          backdropFilter: "blur(6px)",
          cursor: "pointer",
        }}
      >
        <option value="drought" style={{ color: "#02040a" }}>Drought</option>
        <option value="wildfire" style={{ color: "#02040a" }}>Wildfire</option>
        <option value="renewable" style={{ color: "#02040a" }}>Renewable</option>
      </select>
    </div>
  );
}


export default function CompareDashboard() {
  const navigate = useNavigate();
  const [searchParams, setParams] = useSearchParams();
  const initialLeft = (searchParams.get("left") as ThemeKey) || "drought";
  const initialRight = (searchParams.get("right") as ThemeKey) || "drought";
  //for locking view or timeline
  const [syncView, setSyncView] = useState(false);
  const [lockTimeline, setLockTimeline] = useState(false);
  
  //for selecting the themes
  const [leftTheme, setLeftTheme] = useState<ThemeKey>(initialLeft);
  const [rightTheme, setRightTheme] = useState<ThemeKey>(initialRight);

  const iframeARef = React.useRef<HTMLIFrameElement>(null);
  const iframeBRef = React.useRef<HTMLIFrameElement>(null);

  //updates the url
  useEffect(() => {
    setParams({
      left: leftTheme,
      right: rightTheme,
    });
  }, [leftTheme, rightTheme, setParams]);
  //checks if left equals rights -> then we have sync and lock button else not
  const canSync = leftTheme === rightTheme;

  //handles Sync View and Lock Timeline
  useEffect(() => {
    if (!canSync) return;

    const handler = (event: MessageEvent) => {
      if (!syncView && !lockTimeline) return;

      const source = event.source;
      const target =
        source === iframeARef.current?.contentWindow
          ? iframeBRef.current
          : source === iframeBRef.current?.contentWindow
          ? iframeARef.current
          : null;

      if (!target?.contentWindow) return;

      if (syncView && event.data?.type === "VIEW_STATE") {
        target.contentWindow.postMessage(event.data, "*");
      }

      if (lockTimeline && event.data?.type === "TIME_STATE") {
        target.contentWindow.postMessage(event.data, "*");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [syncView, lockTimeline, canSync]);


  const { theme: routeTheme } = useParams<{ theme?: ThemeKey }>();
  const [theme, setTheme] = useState<ThemeKey>(routeTheme || "drought");

  const baseUrl = THEMES[theme];

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      
      {/* TOP BAR */}
      <div
        style={{
          position: "relative",
          padding: "0.9rem 1.5rem",
          background: "rgba(2,4,10,0.6)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(52,211,153,0.25)",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          zIndex: 20,
        }}
      >
        {/* Accent Glow Line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: "2px",
            background:
              "linear-gradient(90deg, transparent, #34d399, #22d3ee, transparent)",
            opacity: 0.6,
          }}
        />
        {/* BACK */}
        <Link
          to="/"
          style={{
            marginLeft: "0.5rem",
            padding: "0.45rem 1rem",
            borderRadius: "999px",
            border: "1px solid rgba(52,211,153,0.35)",
            background:
              "linear-gradient(135deg, rgba(52,211,153,0.85), rgba(34,211,238,0.85))",
            color: "#02040a",
            fontWeight: 700,
            fontSize: "0.7rem",
            letterSpacing: "0.08em",
            textDecoration: "none",
            boxShadow: "0 0 22px rgba(52,211,153,0.45)",
            transition: "all 0.3s ease",
          }}
        >
          ← Back to Landingpage
        </Link>
        {/* TITLE */}
        <div>
          <div
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.25em",
              fontWeight: 700,
              color: "#6ee7b7",
            }}
          >
            SIDE-BY-SIDE
          </div>
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "#ecfdf5",
            }}
          >
            Comparative Analysis
          </div>
        </div>

        {/* SPACER */}
        <div style={{ flex: 1 }} />

        <ThemeSelector label="LEFT" value={leftTheme} onChange={setLeftTheme} />
        <ThemeSelector label="RIGHT" value={rightTheme} onChange={setRightTheme} />
      
        {/* SYNC VIEW */}
        <button
        disabled={!canSync}
          onClick={() => setSyncView((v) => !v)}
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: "999px",
            border: syncView
              ? "1px solid #22d3ee"
              : "1px solid rgba(255,255,255,0.25)",

            background: syncView
              ? "rgba(34,211,238,0.18)"
              : "rgba(255,255,255,0.05)",

            color: syncView ? "#ecfeff" : "#94a3b8",
            fontSize: "0.7rem",
            letterSpacing: "0.08em",
            cursor: "pointer",

            boxShadow: syncView
              ? "0 0 18px rgba(34,211,238,0.45)"
              : "none",

            opacity: syncView ? 1 : 0.55,
            transition: "all 0.25s ease",
          }}
        >
          🔗 Sync View
        </button>
        <button
          disabled={!canSync}
          onClick={() => setLockTimeline((v) => !v)}
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: "999px",
            border: lockTimeline
              ? "1px solid #facc15"
              : "1px solid rgba(255,255,255,0.25)",

            background: lockTimeline
              ? "rgba(250,204,21,0.18)"
              : "rgba(255,255,255,0.05)",

            color: lockTimeline ? "#fffbeb" : "#94a3b8",
            fontSize: "0.7rem",
            letterSpacing: "0.08em",
            cursor: "pointer",

            boxShadow: lockTimeline
              ? "0 0 18px rgba(250,204,21,0.45)"
              : "none",

            opacity: lockTimeline ? 1 : 0.55,
            transition: "all 0.25s ease",
          }}
        >
          🔒 Lock Timeline
        </button>
        <span
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.08em",
            color: canSync ? "#64748b" : "#fbbf24",
            opacity: canSync ? 0.6 : 0.9,
            transition: "all 0.3s ease",
          }}
        >
          {canSync
            ? "Sync available for identical dashboards"
            : "Sync only works when both dashboards match"}
        </span>
      </div>

      {/* SIDE BY SIDE */}
      <div style={{ flex: 1, display: "flex" }}>
        
        {/* ANALYST A */}
        <iframe
          title="Analyst A"
          ref={iframeARef}
          src={`${THEMES[leftTheme]}?session=A&sideBySide=true`}
          style={{
            flex: 1,
            border: "none",
          }}
        />

        {/* ANALYST B */}
        <iframe
          title="Analyst B"
          ref={iframeBRef}
          src={`${THEMES[rightTheme]}?session=B&sideBySide=true`}
          style={{
            flex: 1,
            border: "none",
          }}
        />
      </div>
    </div>
  );
}

