const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Map, { NavigationControl, Marker, MapRef, Source, Layer, CircleLayer } from "react-map-gl/mapbox";
import * as d3 from "d3";
import "mapbox-gl/dist/mapbox-gl.css";

// --- CONFIGURATION ---
const FIRE_DATA_URL = "/data/annual-number-of-fires.csv"; 
const CITY_TEMP_DATA_URL = "/data/clustered_weather_data.csv";
const COUNTRY_META_URL = "/data/country-meta.json";
const GEOJSON_URL = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";

// --- TYPES ---
type Region = "europe" | "asia" | "americas" | "africa" | "oceania";

type FireDataPoint = {
  id: string;
  name: string;
  code: string;
  lat: number;
  lon: number;
  fires: number;
  year: number;
  region: Region;
};

type CityTempPoint = {
    city_id: string;
    city_name: string;
    country: string;
    lat: number;
    lng: number;
    tavg: number;
};

type TempDataMap = {
  [year: number]: {
    annual: CityTempPoint[];
    monthly: { [month: number]: CityTempPoint[] };
  }
};

type CountryMetaType = Record<string, { lat: number; lon: number; region: Region }>;

type ChatMessage = {
    role: "user" | "assistant" | "system";
    content: string;
};

// --- REGION VIEWPORTS ---
const REGION_VIEWPORTS: Record<Region, { center: [number, number]; zoom: number }> = {
    europe: { center: [15, 50], zoom: 3.5 },
    asia: { center: [90, 30], zoom: 2.8 },
    americas: { center: [-80, 10], zoom: 2.2 },
    africa: { center: [20, 0], zoom: 3 },
    oceania: { center: [140, -25], zoom: 3.2 }
};

const INITIAL_VIEW_STATE = {
  latitude: 20,
  longitude: 0,
  zoom: 2.2 
};


export default function AnnualFiresMap() {
  const BACKEND = import.meta.env.VITE_BACKEND_API_URL;
  console.log("BACKEND URL:", BACKEND);
  const mapRef = useRef<MapRef>(null);

  // --- STATE ---
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [fireData, setFireData] = useState<FireDataPoint[]>([]);
  const [cityTempData, setCityTempData] = useState<TempDataMap>({});
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // MAP LABEL LAYER ID
  const [labelLayerId, setLabelLayerId] = useState<string | undefined>(undefined);

  // Filters
  const [selectedYear, setSelectedYear] = useState(2012);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
  
  // LAYER VISIBILITY
  const [showTempLayer, setShowTempLayer] = useState(true);
  const [showFireLayer, setShowFireLayer] = useState(true);

  // TEMP VIEW MODE
  const [tempViewMode, setTempViewMode] = useState<"annual" | "monthly">("annual");
  const [selectedMonth, setSelectedMonth] = useState(1); 

  // ANIMATION
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Interaction
  const [hoveredInfo, setHoveredInfo] = useState<FireDataPoint | null>(null);
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });

  // --- AI CHAT STATE ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
      { role: "assistant", content: "Hello! I analyze the fire & temperature data you see on the screen. How can I help?" }
  ]);
  const [userMessage, setUserMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- MAP LOAD EVENT ---
  const onMapLoad = (event: any) => {
    const map = event.target;
    const layers = map.getStyle().layers;
    const labelLayer = layers.find(
        (layer: any) => layer.type === 'symbol' && layer.layout['text-field']
    );
    if (labelLayer) {
        setLabelLayerId(labelLayer.id);
    }
  };
  //For side by side dashboard
  const [sideBySide, setSideBySide] = useState(false);

  useEffect(() => {
    //  read URL-Parameter
    const params = new URLSearchParams(window.location.search);
    const sbs = params.get("sideBySide");

    // if true activate side by side
    setSideBySide(sbs === "true");
  }, []);

  // --- SYNC VIEW STATE (Side-by-Side Dashboard) ---
  useEffect(() => {
    if (!sideBySide) return;

    const handler = (e: MessageEvent) => {
      if (e.data?.type === "VIEW_STATE") {
        setViewState(e.data.payload);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sideBySide]);


  // --- SYNC TIME STATE (Year / Month / Play) ---
  useEffect(() => {
    if (!sideBySide) return;

    const handler = (e: MessageEvent) => {
      if (e.data?.type === "TIME_STATE") {
        if (typeof e.data.payload.year === "number") {
          setSelectedYear(e.data.payload.year);
        }

        if (typeof e.data.payload.month === "number") {
        setSelectedMonth(e.data.payload.month);
        }

        setIsPlaying(false); // stop animation when synced
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sideBySide]);


  // --- DATA LOADING ---
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const [loadedMeta, geoJson, rawFireData, rawTempData] = await Promise.all([
            d3.json(COUNTRY_META_URL) as Promise<CountryMetaType>,
            d3.json(GEOJSON_URL),
            d3.csv(FIRE_DATA_URL),
            d3.csv(CITY_TEMP_DATA_URL)
        ]);

        setGeoJsonData(geoJson);

        const processedFireData: FireDataPoint[] = [];
        rawFireData.forEach((row: any) => {
          const code = row.Code;
          const meta = loadedMeta[code]; 
          if (meta) { 
            const year = parseInt(row.Year);
            const fires = parseInt(row["Annual number of fires"] || "0");
            processedFireData.push({
              id: code, name: row.Entity, code: code,
              lat: meta.lat, lon: meta.lon, region: meta.region,
              year: year, fires: fires
            });
          }
        });
        setFireData(processedFireData);

        const tempMap: TempDataMap = {};
        const yearsSet = new Set<number>();
        const annualCalc: Record<number, Record<string, { sum: number, count: number, meta: any }>> = {};

        rawTempData.forEach((row: any) => {
            const dateStr = row.time; 
            const date = new Date(dateStr);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const cityId = row.city_id;
            const tavg = parseFloat(row.tavg);
            const lat = parseFloat(row.lat);
            const lng = parseFloat(row.lng);

            if (!isNaN(year) && !isNaN(tavg)) {
                yearsSet.add(year);

                if (!tempMap[year]) tempMap[year] = { annual: [], monthly: {} };
                if (!tempMap[year].monthly[month]) tempMap[year].monthly[month] = [];

                const pointData: CityTempPoint = {
                    city_id: cityId,
                    city_name: row.city_name,
                    country: row.country,
                    lat: lat,
                    lng: lng,
                    tavg: tavg
                };
                tempMap[year].monthly[month].push(pointData);

                if (!annualCalc[year]) annualCalc[year] = {};
                if (!annualCalc[year][cityId]) {
                    annualCalc[year][cityId] = { sum: 0, count: 0, meta: pointData };
                }
                annualCalc[year][cityId].sum += tavg;
                annualCalc[year][cityId].count += 1;
            }
        });

        Object.keys(annualCalc).forEach(yStr => {
            const y = parseInt(yStr);
            Object.values(annualCalc[y]).forEach(calc => {
                const avg = calc.sum / calc.count;
                tempMap[y].annual.push({
                    ...calc.meta,
                    tavg: avg
                });
            });
        });

        setCityTempData(tempMap);
        const years = Array.from(yearsSet).sort((a, b) => a - b);
        setAvailableYears(years);
        if (years.length > 0) setSelectedYear(years[0]);
        setLoading(false);

      } catch (error) {
        console.error("Error loading Data:", error);
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // --- ACTIVE DATA MEMOS ---
  const activeTempData = useMemo(() => {
    if (!cityTempData[selectedYear]) return [];
    if (tempViewMode === "annual") {
        return cityTempData[selectedYear].annual;
    } else {
        return cityTempData[selectedYear].monthly[selectedMonth] || [];
    }
  }, [cityTempData, selectedYear, tempViewMode, selectedMonth]);

  const tempPointsGeoJson = useMemo(() => {
    return {
        type: "FeatureCollection",
        features: activeTempData.map(p => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
            properties: { tavg: p.tavg, name: p.city_name }
        }))
    };
  }, [activeTempData]);

  // --- TEMP BY COUNTRY (Annual + Selected Month) ---
const normalizeCountry = (s: string) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,()']/g, "");

const COUNTRY_ALIASES: Record<string, string> = {
  "united states": "united states of america",
  "usa": "united states of america",
  "russia": "russian federation",
  "south korea": "korea, republic of",
  "north korea": "korea, democratic people's republic of",
  "iran": "iran, islamic republic of",
  "syria": "syrian arab republic",
  "vietnam": "viet nam",
  "bolivia": "bolivia, plurinational state of",
  "tanzania": "tanzania, united republic of",
  "venezuela": "venezuela, bolivarian republic of",
};

function buildAvgMap(points: CityTempPoint[]) {
  const acc: Record<string, { sum: number; count: number }> = {};
  for (const p of points) {
    const k = normalizeCountry(p.country);
    if (!k) continue;
    if (!acc[k]) acc[k] = { sum: 0, count: 0 };
    acc[k].sum += p.tavg;
    acc[k].count += 1;
  }
  const out: Record<string, number> = {};
  Object.entries(acc).forEach(([k, v]) => {
    out[k] = v.sum / v.count;
  });
  return out;
}

const { annualAvgByCountry, monthAvgByCountry, annualKeys, monthKeys } = useMemo(() => {
  const annualPoints = cityTempData[selectedYear]?.annual ?? [];
  const monthPoints = cityTempData[selectedYear]?.monthly?.[selectedMonth] ?? [];

  const annual = buildAvgMap(annualPoints);
  const monthly = buildAvgMap(monthPoints);

  return {
    annualAvgByCountry: annual,
    monthAvgByCountry: monthly,
    annualKeys: Object.keys(annual),
    monthKeys: Object.keys(monthly),
  };
}, [cityTempData, selectedYear, selectedMonth]);

function lookupCountryTemp(countryName: string, map: Record<string, number>, keys: string[]) {
  const key0 = normalizeCountry(countryName);
  if (map[key0] != null) return map[key0];

  const alias = COUNTRY_ALIASES[key0];
  if (alias && map[alias] != null) return map[alias];

  // Simple fuzzy match: best substring overlap
  let bestKey: string | null = null;
  let bestScore = 0;
  for (const k of keys) {
    if (k.includes(key0) || key0.includes(k)) {
      const score = Math.min(k.length, key0.length);
      if (score > bestScore) {
        bestScore = score;
        bestKey = k;
      }
    }
  }
  if (bestKey) return map[bestKey];
  return null;
}

const fmtTemp = (v: number | null) => (v == null || Number.isNaN(v) ? "N/A" : `${v.toFixed(1)}°C`);

  // --- FILTER LOGIC ---
  const filteredFireData = useMemo(() => {
    let data = fireData.filter(d => d.year === selectedYear);
    if (selectedRegions.length > 0) data = data.filter(d => selectedRegions.includes(d.region));
    if (searchTerm) data = data.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return data.filter(d => d.fires > 0).sort((a, b) => b.fires - a.fires);
  }, [fireData, selectedYear, selectedRegions, searchTerm]);

  const selectedCountries = useMemo(
    () => filteredFireData.filter((c) => selectedIds.includes(c.id)),
    [filteredFireData, selectedIds]
  );
  const tableCountries = selectedCountries.length ? selectedCountries : filteredFireData;

  const maxFires = useMemo(() => d3.max(fireData, d => d.fires) || 10000, [fireData]);
  const radiusScale = d3.scaleSqrt().domain([0, maxFires]).range([2, 50]);

  // --- ANIMATION LOOPS ---
  useEffect(() => {
    let interval: any;
    if (isPlaying && availableYears.length > 0) {
      const delay = tempViewMode === "monthly" ? 800 : 1100;
      interval = setInterval(() => {
        if (tempViewMode === "annual") {
            setSelectedYear((prev) => {
                const currentIndex = availableYears.indexOf(prev);
                const nextIndex = (currentIndex + 1) % availableYears.length;
                return availableYears[nextIndex];
            });
        } else {
            setSelectedMonth((prevMonth) => {
                if (prevMonth < 12) return prevMonth + 1;
                else {
                    setSelectedYear((prevYear) => {
                        const currentIndex = availableYears.indexOf(prevYear);
                        const nextIndex = (currentIndex + 1) % availableYears.length;
                        return availableYears[nextIndex];
                    });
                    return 1;
                }
            });
        }
      }, delay);
    }
    return () => clearInterval(interval);
  }, [isPlaying, availableYears, tempViewMode]);

  useEffect(() => {
    let animationFrameId: number;
    const rotateGlobe = () => {
        if(isPlaying) {
             setViewState((prev) => ({ ...prev, longitude: prev.longitude + 0.15 }));
        }
        animationFrameId = requestAnimationFrame(rotateGlobe);
    };
    rotateGlobe();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  // --- CHAT LOGIC ---
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatOpen]);


  const resetChat = () => {
      setChatMessages([
        { role: "assistant", content: "Hello! I analyze the fire & temperature data you see on the screen. How can I help?" }
      ]);
      setUserMessage("");
      setIsChatLoading(false);
    }

  const handleSendMessage = async () => {
    if (!userMessage.trim()) return;

    const newMessage: ChatMessage = { role: "user", content: userMessage };
    setChatMessages(prev => [...prev, newMessage]);
    setUserMessage("");
    setIsChatLoading(true);

    // Context preparation
    const tempMap = tempViewMode === "annual" ? annualAvgByCountry : monthAvgByCountry;
    const tempKeys = tempViewMode === "annual" ? annualKeys : monthKeys;
    const topCountries = tableCountries.slice(0, 5).map(c => {
        const temp = lookupCountryTemp(c.name, tempMap, tempKeys);
        return `${c.name} (${c.fires} fires, Avg Temp: ${fmtTemp(temp)})`;
    }).join(", ");
    
    const systemContext = `
    You are a specialized AI assistant for a data visualization dashboard focused strictly on
    environmental protection, climate change, wildfires, and temperature-related analysis.

    Your knowledge:
    - Wildfire data and trends
    - Temperature and climate-related data
    - Environmental impact, risk assessment, and protection strategies
    - Insights derived ONLY from the current dashboard state
    - Related stuff

    You must NOT:
    - Don't ask about "providing pdf" or "give me pdf" or something. User interaction face not capable to do that.

    Current Dashboard State:
    - Year: ${selectedYear}
    - Selected Regions: ${selectedRegions.length > 0 ? selectedRegions.join(", ") : "All World"}
    - View Mode: ${tempViewMode}
    - Top Visible Countries by Fire: ${topCountries}

    Use this data to answer the user's questions accurately and concisely.
    `;

    try {
        const response = await fetch(`${BACKEND}/api/openai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: newMessage.content,
            systemContext,
            year: selectedYear,
            regions: selectedRegions,
            tempViewMode,
            topCountries,
          }),
        });

        const data = await response.json();
        if (data.answer) {
          setChatMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
        } else {
          setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, backend returned no answer." }]);
        }

    } catch (error) {
        console.error(error);
        setChatMessages(prev => [...prev, { role: "assistant", content: "Error connecting to AI service." }]);
    } finally {
        setIsChatLoading(false);
    }
  };

  // --- ACTIONS ---
  const handleClearAll = () => {
    setSelectedIds([]); 
    setSearchTerm(""); 
    setSelectedRegions([]); 
    setIsPlaying(false);
    mapRef.current?.flyTo({ center: [0, 20], zoom: 2.2, duration: 1500 });
  };

  const handleCountryClick = (c: FireDataPoint) => {
    setSelectedIds((prev) => prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]);
    mapRef.current?.flyTo({ center: [c.lon, c.lat], zoom: 4, duration: 1500 });
  };

  const handleRegionToggle = (region: Region) => {
    let newRegions: Region[];
    if (selectedRegions.includes(region)) {
      newRegions = selectedRegions.filter(r => r !== region);
    } else {
      newRegions = [...selectedRegions, region];
      const viewport = REGION_VIEWPORTS[region];
      if (viewport) mapRef.current?.flyTo({ center: viewport.center, zoom: viewport.zoom, duration: 1500, essential: true });
    }
    setSelectedRegions(newRegions);
  };

  // --- STYLES ---
  const tempPointLayerStyle: CircleLayer = {
    id: 'temp-points-layer',
    type: 'circle',
    paint: {
        'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            3, 12,
            7, 45,
            10, 150
        ],
        'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'tavg'],
            -20, '#1e40af', 
            -5,  '#3b82f6', 
            5,   '#22d3ee', 
            15,  '#84cc16', 
            25,  '#facc15', 
            35,  '#ef4444' 
        ],
        'circle-opacity': 0.60,
        'circle-blur': 0.6 
    }
  };

  const regionsList: Region[] = ["europe", "asia", "americas", "africa", "oceania"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const tempLineStyle: React.CSSProperties = {
  color: "#000",
  fontSize: "0.85rem",
  fontWeight: 500,
  marginTop: "4px",
  lineHeight: 1.25,
};
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "#fff7ed", overflow: "hidden", fontFamily: "system-ui, sans-serif", display: "flex" }}>
      
      {/* HEADER (Only Back Link & Main Title) */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", zIndex: 10, pointerEvents: "none", padding: "2rem" }}>
        <div style={{ maxWidth: "600px", pointerEvents: "auto" }}>
          {!sideBySide && (<Link to="/" style={{ fontSize: "0.9rem", color: "#c2410c", textDecoration: "none", fontWeight: "bold" }}>← Back to Landingpage</Link>)}
          <h1 style={{ fontSize: "2.2rem", margin: "0.5rem 0", fontWeight: 700, color: "#7c2d12" }}>Global Annual Fires & City Temp</h1>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", height: "100%" }}>
        {loading && <div style={{position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", fontWeight:"bold", color:"#c2410c", zIndex: 100}}>Loading Data...</div>}
        
        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => {
            const nextView = evt.viewState;
            setViewState(nextView);

            window.parent.postMessage(
              {
                type: "VIEW_STATE",
                payload: nextView,
              },
              "*"
            );
          }}

          onLoad={onMapLoad}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          projection="globe"
          boxZoom={false}
        >
          {geoJsonData && (
             <Source id="world-borders" type="geojson" data={geoJsonData}>
                 <Layer 
                    id="border-line" 
                    type="line" 
                    beforeId={labelLayerId}
                    paint={{'line-color': '#cbd5e1', 'line-width': 1}} 
                 />
             </Source>
          )}

          {showTempLayer && (
              <Source id="temp-city-source" type="geojson" data={tempPointsGeoJson as any}>
                  <Layer 
                    {...tempPointLayerStyle} 
                    beforeId={labelLayerId}
                  />
              </Source>
          )}

          {showFireLayer && filteredFireData.map((country) => {
              const isSelected = selectedIds.includes(country.id);
              const isHovered = hoveredInfo?.id === country.id;
              const radius = radiusScale(country.fires);
              const displayRadius = isSelected || isHovered ? radius * 1.2 : radius;
              const zIndex = isHovered ? 100 : (isSelected ? 50 : 20);

              return (
                  <Marker key={country.id} longitude={country.lon} latitude={country.lat} anchor="center" style={{ zIndex }}>
                      <div
                          style={{ width: displayRadius * 2, height: displayRadius * 2, position: "relative", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}
                          onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredInfo(country);
                              setHoveredPos({ x: rect.left + rect.width/2, y: rect.top });
                          }}
                          onMouseLeave={() => setHoveredInfo(null)}
                          onClick={(e) => { e.stopPropagation(); handleCountryClick(country); }}
                      >
                          <div style={{
                            width: "100%", height: "100%", borderRadius: "50%",
                            backgroundColor: "rgba(234, 88, 12, 0.6)",
                            border: isSelected ? "3px solid #9a3412" : "1px solid #ea580c",
                            boxShadow: isSelected || isHovered ? "0 0 15px rgba(234, 88, 12, 0.5)" : "none"
                          }} />
                      </div>
                  </Marker>
              );
          })}
          <NavigationControl position="bottom-left" />
        </Map>
        
        {/* LEGEND */}
        {showTempLayer && (
            <div style={{ position: "absolute", bottom: "30px", left: "60px", background: "rgba(255,255,255,0.95)", padding: "12px", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", fontSize: "0.75rem", pointerEvents: "none", zIndex: 100 }}>
                <div style={{ marginBottom: "8px", fontWeight: "700", color: "#374151" }}>City Temp (°C)</div>
                <div style={{ width: "140px", height: "12px", borderRadius: "99px", background: "linear-gradient(to right, #1e40af, #3b82f6, #22d3ee, #84cc16, #facc15, #ef4444)" }}></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", color: "#6b7280", fontWeight: "500" }}>
                    <span>-20°</span>
                    <span>0°</span>
                    <span>+35°</span>
                </div>
            </div>
        )}
      </div>

      {hoveredInfo && (
        <div style={{ position: "fixed", zIndex: 99999, pointerEvents: "none", left: hoveredPos.x, top: hoveredPos.y, transform: 'translate(-50%, -110%)', backgroundColor: "white", padding: "0.6rem", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontSize: "0.85rem", border: "1px solid #fed7aa" }}>
          <div style={{fontWeight:"bold", color:"#7c2d12", fontSize:"0.95rem"}}>{hoveredInfo.name}</div>
          <div style={{color:"#ea580c", fontWeight:600}}>🔥 {hoveredInfo.fires.toLocaleString()} fires</div>
          {(() => {
  const annualT = lookupCountryTemp(hoveredInfo.name, annualAvgByCountry, annualKeys);
  const monthT = lookupCountryTemp(hoveredInfo.name, monthAvgByCountry, monthKeys);
  return (
  <>
    <div style={tempLineStyle}>
      🌡️ Annual Avg: {fmtTemp(annualT)}
    </div>
    <div style={{ ...tempLineStyle, marginTop: "2px" }}>
      📅 {months[selectedMonth - 1]} Avg: {fmtTemp(monthT)}
    </div>
  </>
);
})()}
          <div style={{color:"#9ca3af", fontSize:"0.75rem"}}>Year: {hoveredInfo.year}</div>
        </div>
      )}

      {/* AI CHAT PANEL (Full Height, Left of Sidebar) */}
      {isChatOpen && (
          <div style={{
              width: "350px",
              height: "100vh",
              backgroundColor: "#fefce8", // Slightly different tone
              borderRight: "1px solid #fed7aa",
              display: "flex",
              flexDirection: "column",
              zIndex: 49, // Just below sidebar (z-index 50)
              boxShadow: "-2px 0 10px rgba(0,0,0,0.05)",
              position: "fixed",
              right: "400px", // Offset by sidebar width
              top: 0
          }}>
             <div
                style={{
                  padding: "1rem",
                  borderBottom: "1px solid #fed7aa",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#fef3c7",
                }}
              >
                <span style={{ fontWeight: "bold", color: "#7c2d12" }}>AI Data Assistant 🤖</span>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    onClick={resetChat}
                    style={{
                      border: "1px solid #fed7aa",
                      background: "white",
                      borderRadius: "10px",
                      padding: "6px 10px",
                      cursor: "pointer",
                      color: "#7c2d12",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                    }}
                    title="Chat'i temizle"
                  >
                    🧹 Clear
                  </button>

                  <button
                    onClick={() => setIsChatOpen(false)}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: "1.2rem",
                      cursor: "pointer",
                      color: "#7c2d12",
                    }}
                    title="Kapat"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div style={{ flex: 1, padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {chatMessages.map((msg, i) => (
                      <div key={i} style={{ 
                          alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                          background: msg.role === "user" ? "#f97316" : "white",
                          color: msg.role === "user" ? "white" : "#374151",
                          padding: "10px 14px",
                          borderRadius: "12px",
                          maxWidth: "85%",
                          fontSize: "0.85rem",
                          lineHeight: "1.4",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                      }}>
                          {msg.content}
                      </div>
                  ))}
                  {isChatLoading && <div style={{ alignSelf: "flex-start", color: "#9ca3af", fontSize: "0.8rem", fontStyle: "italic" }}>AI analyzing data...</div>}
                  <div ref={chatEndRef} />
              </div>

              <div style={{ padding: "1rem", borderTop: "1px solid #fed7aa", display: "flex", gap: "0.5rem", background: "white" }}>
                  <input 
                      type="text" 
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Ask about trends..." 
                      style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: "6px", padding: "8px", fontSize: "0.9rem", outline: "none" }}
                  />
                  <button onClick={handleSendMessage} style={{ background: "#f97316", color: "white", border: "none", borderRadius: "6px", padding: "0 14px", cursor: "pointer", fontSize: "1.1rem" }}>➤</button>
              </div>
          </div>
      )}

      {/* SIDEBAR (Main Control) */}
      <div style={{ width: "400px", height: "100vh", backgroundColor: "white", borderLeft: "1px solid #fed7aa", boxShadow: "-4px 0 15px rgba(0,0,0,0.05)", padding: "2rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.2rem", fontSize: "0.9rem", zIndex: 50, position: "relative" }}>
        
        {/* SIDEBAR HEADER: Chat Button Left, Interactions Text Right */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            style={{ 
                background: "linear-gradient(135deg, #f97316 0%, #db2777 100%)", 
                border: "none", 
                borderRadius: "20px", 
                padding: "0.5rem 1rem", 
                color: "white", 
                fontWeight: "bold", 
                fontSize: "0.8rem", 
                cursor: "pointer", 
                boxShadow: "0 4px 6px rgba(219, 39, 119, 0.3)",
                transition: "transform 0.1s"
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.95)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            {isChatOpen ? "Close AI" : "Chat With AI ✨"}
          </button>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#c2410c" }}>Interactions</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#7c2d12" }}>Timeline & Filtering</div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <input 
            type="text" 
            placeholder="Search country..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid #fed7aa", fontSize: "0.9rem", outline: "none", backgroundColor: "#fff7ed", color: "#374151" }} 
        />

        {/* INLINE LAYER CONTROL */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            padding: "0.5rem",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            background: "#f9fafb",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              cursor: "pointer",
              fontSize: "0.8rem",
              color: "#4b5563",
            }}
          >
            <input
              type="checkbox"
              checked={showTempLayer}
              onChange={(e) => setShowTempLayer(e.target.checked)}
              style={{
                accentColor: "#ef4444",
                backgroundColor: "#ffffff",
              }}
            />
            <span>Show City Temp</span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              cursor: "pointer",
              fontSize: "0.8rem",
              color: "#4b5563",
            }}
          >
            <input
              type="checkbox"
              checked={showFireLayer}
              onChange={(e) => setShowFireLayer(e.target.checked)}
              style={{
                accentColor: "#ef4444", // SAME as City Temp
                backgroundColor: "#ffffff",
              }}
            />
            <span>Show Fire Markers</span>
          </label>
        </div>

        <div>
            <div style={{ fontWeight: 500, color: "#7c2d12", marginBottom: "0.5rem" }}>Regions:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {regionsList.map(region => {
                    const active = selectedRegions.includes(region);
                    return (
                        <button key={region} onClick={() => handleRegionToggle(region)}
                            style={{ padding: "0.3rem 0.6rem", borderRadius: "99px", border: active ? "1px solid #ea580c" : "1px solid #fed7aa", backgroundColor: active ? "#ea580c" : "white", color: active ? "white" : "#7c2d12", fontSize: "0.75rem", fontWeight: 600, textTransform: "capitalize", cursor: "pointer", transition: "all 0.2s" }}>
                            {region}
                        </button>
                    );
                })}
            </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#fff7ed", padding: "0.5rem", borderRadius: "8px" }}>
            <span style={{ fontWeight: 600, color: "#7c2d12", fontSize: "0.8rem" }}>Temp View:</span>
            <button onClick={() => setTempViewMode("annual")} style={{ flex: 1, padding: "0.3rem", borderRadius: "4px", border: "none", background: tempViewMode === "annual" ? "#ea580c" : "transparent", color: tempViewMode === "annual" ? "white" : "#7c2d12", cursor: "pointer", fontWeight: 600 }}>Annual Avg</button>
            <button onClick={() => setTempViewMode("monthly")} style={{ flex: 1, padding: "0.3rem", borderRadius: "4px", border: "none", background: tempViewMode === "monthly" ? "#ea580c" : "transparent", color: tempViewMode === "monthly" ? "white" : "#7c2d12", cursor: "pointer", fontWeight: 600 }}>Monthly</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems:"center", fontWeight: 600, color: "#7c2d12" }}>
             <span>Year: {selectedYear}</span>
             <button onClick={() => setIsPlaying(!isPlaying)}
                style={{ background: isPlaying ? "#fecaca" : "#dcfce7", color: isPlaying ? "#b91c1c" : "#15803d", border: "none", borderRadius: "6px", padding: "0.2rem 0.6rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" }}>
                {isPlaying ? "❚❚ Stop" : "▶ Play Loop"}
             </button>
          </div>
          
          {availableYears.length > 0 && (
            <input type="range" min={availableYears[0]} max={availableYears[availableYears.length - 1]} step={1} value={selectedYear} onChange={(e) => {const year = Number(e.target.value); setIsPlaying(false); setSelectedYear(Number(e.target.value)); window.parent.postMessage({type: "TIME_STATE",payload:{year, month:selectedMonth,},},"*"); }} style={{ width: "100%", accentColor: "#ea580c", cursor: "pointer" }} />
          )}
        </div>

        {tempViewMode === "monthly" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", background: "#eff6ff", padding: "0.5rem", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                <div style={{ fontWeight: 600, color: "#1e40af", fontSize: "0.85rem", display:"flex", justifyContent:"space-between" }}>
                   <span>Month: {months[selectedMonth - 1]}</span>
                   <span style={{fontSize:"0.7rem", color:"#60a5fa"}}>Auto-plays in Loop</span>
                </div>
                <input type="range" min={1} max={12} step={1} value={selectedMonth} onChange={(e) => { const month = Number(e.target.value); setIsPlaying(false); setSelectedMonth(Number(e.target.value)); window.parent.postMessage({type: "TIME_STATE",payload:{selectedYear, month,},},"*"); }} style={{ width: "100%", accentColor: "#3b82f6", cursor: "pointer" }} />
            </div>
        )}

        <button onClick={handleClearAll} style={{ padding: "0.5rem", backgroundColor: "white", border: "1px solid #ef4444", color: "#ef4444", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, transition: "all 0.2s" }} onMouseEnter={(e) => {e.currentTarget.style.backgroundColor = "#fef2f2"}} onMouseLeave={(e) => {e.currentTarget.style.backgroundColor = "white"}}>
            Clear All Selection & Filters
        </button>

        <div style={{ height: "1px", backgroundColor: "#fed7aa", margin: "0.5rem 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", fontWeight: 600 }}>
          <span>Countries (Fires)</span>
          <span>{tableCountries.length} shown</span>
        </div>

        <div style={{ overflowY: "auto", flex: 1, paddingRight: "5px" }}>
          {tableCountries.map((c) => {
            const active = hoveredInfo?.id === c.id || selectedIds.includes(c.id);
            return (
              <div key={c.id} onMouseEnter={() => setHoveredInfo(c)} onMouseLeave={() => setHoveredInfo(null)} onClick={() => handleCountryClick(c)}
                style={{ padding: "0.6rem", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", backgroundColor: active ? "#ffedd5" : "transparent", cursor: "pointer", borderLeft: active ? "4px solid #ea580c" : "4px solid transparent", transition: "all 0.1s ease-out" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#431407" }}>{c.name}</span>
                  <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{c.region.toUpperCase()}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
  <div style={{ fontSize: "0.8rem", textAlign: "right", color: "#ea580c", fontWeight: 600 }}>
    🔥 {c.fires.toLocaleString()}
  </div>

  {(() => {
    const annualT = lookupCountryTemp(c.name, annualAvgByCountry, annualKeys);
    const monthT = lookupCountryTemp(c.name, monthAvgByCountry, monthKeys);

    // Same font/size as fire count, black
    const tempStyle: React.CSSProperties = {
      fontSize: "0.7rem",
      fontWeight: 600,
      color: "#000",
      lineHeight: 1.1,
      textAlign: "right",
    };

    return (
      <>
        <div style={tempStyle}>🌡️ {fmtTemp(annualT)}</div>
        <div style={tempStyle}>
          📅 {months[selectedMonth - 1]} {fmtTemp(monthT)}
        </div>
      </>
    );
  })()}
</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
