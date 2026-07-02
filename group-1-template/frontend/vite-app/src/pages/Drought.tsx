import * as React from "react";
import DeckGL from "@deck.gl/react";
import { Link } from "react-router-dom";
import { FlyToInterpolator } from "@deck.gl/core";
import { ScatterplotLayer, GeoJsonLayer } from "@deck.gl/layers";
import { _GlobeView as GlobeView, _GlobeController as GlobeController } from "@deck.gl/core";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { Map } from "react-map-gl/maplibre";
import { COORDINATE_SYSTEM } from "@deck.gl/core";
import { rgb } from "d3-color";
import { scaleSequential, scaleLinear, scaleSqrt } from "d3-scale";
import { interpolateOrRd } from "d3-scale-chromatic";
import { interpolateGreens } from "d3-scale-chromatic";
import type { WebGLParameters } from "@deck.gl/core";


import worldDataJson from "./custom.geo.json";
import centroid from "@turf/centroid";
import area from "@turf/area";
import { FeatureCollection } from "geojson";

// --- TYPES & DATA ---
const worldData = worldDataJson as FeatureCollection;

// Region bounding boxes
const regions: Record<string, [number, number, number, number]> = {
  "Europe": [-31.3, 34.5, 39.6, 71.2],
  "Asia": [26.0, -10.0, 180.0, 81.0],
  "Africa": [-17.0, -35.0, 51.0, 37.0],
  "North America": [-168.0, 5.0, -52.0, 83.0],
  "South America": [-81.0, -56.0, -34.0, 13.0],
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#047857",
  fontWeight: 700,
  marginBottom: "0.4rem"
};

const sectionValueStyle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: "#064e3b"
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

// --- HELPER FUNCTIONS ---
function getMainlandCentroid(feature: any) {
  if (!feature.geometry) return null;

  // if MultiPolygon take the biggest Polygo as Mainland
  if (feature.geometry.type === "MultiPolygon") {
    let largestPolygon = feature.geometry.coordinates[0];
    let maxArea = 0;

    for (const polygon of feature.geometry.coordinates) {
      const polyArea = area({ type: "Feature", geometry: { type: "Polygon", coordinates: polygon }, properties:{} });
      if (polyArea > maxArea) {
        maxArea = polyArea;
        largestPolygon = polygon;
      }
    }

    // return centroid of biggest polygon
    return centroid({ type: "Feature", geometry: { type: "Polygon", coordinates: largestPolygon }, properties:{} });
  }

  // if one polygon then return normal centroid
  return centroid(feature);
}

function getIsoFromFeature(feature: any): string | null {
  const p = feature?.properties;
  if (!p) return null;

  // priorities
  // 1. iso_a3 (if valid)
  // 2. iso_a3_eh (Natural Earth special handling)
  // 3. adm0_a3
  // 4. gu_a3 (last fallback)

  if (p.iso_a3 && p.iso_a3 !== "-99") return p.iso_a3;
  if (p.iso_a3_eh && p.iso_a3_eh !== "-99") return p.iso_a3_eh;
  if (p.adm0_a3 && p.adm0_a3 !== "-99") return p.adm0_a3;
  if (p.gu_a3 && p.gu_a3 !== "-99") return p.gu_a3;

  return null;
}

function addCoordinates(data: any[]) {
  return data
    .map((d) => {
      const f = worldData.features.find(
        (x) => getIsoFromFeature(x) === d.CTY_CODE?.trim().toUpperCase());
      if (!f) return null;
      const center = getMainlandCentroid(f);
      return {
        ...d,
        lon: center.geometry.coordinates[0],
        lat: center.geometry.coordinates[1],
      };
    })
    .filter(Boolean);
}

function addCoordinatesToDroughts(data: any[]) {
  return data
    .map((d) => {
      const f = worldData.features.find(
        (x) => getIsoFromFeature(x) === d.CTY_CODE?.trim().toUpperCase()
      );
      if (!f) return null;
      const center = getMainlandCentroid(f);
      return {
        ...d,
        lon: center.geometry.coordinates[0],
        lat: center.geometry.coordinates[1],
        intensity: Number(d.INTENSITY),
        severity: Number(d.SEVERITY),
        duration: Number(d.DURATION),
        avgArea: Number(d.AVERAGE_AREA),
        widestArea: Number(d.WIDEST_AREA_PERC),
        score: Number(d.SCORE),
      };
    })
    .filter(Boolean);
}

function filterDroughtsForMonth(data: any[], year: number, month: number) {
  return data.filter(d => {
    const start = new Date(d.START_DATE);
    const end = new Date(d.END_DATE);
    return (
      (start.getFullYear() < year || (start.getFullYear() === year && start.getMonth() + 1 <= month)) &&
      (end.getFullYear() > year || (end.getFullYear() === year && end.getMonth() + 1 >= month))
    );
  });
}

const severityColorScale = scaleSequential(interpolateOrRd).domain([0, 20]);

// --- MAIN COMPONENT ---
const MapGlobeSwitcher: React.FC = () => {
  const BACKEND = import.meta.env.VITE_BACKEND_API_URL;

  // --- STATE: VIEW & DATA ---
  const [viewMode, setViewMode] = React.useState<"map" | "globe">("map");
  const [layerMode, setLayerMode] = React.useState<"agriculture" | "climate">("agriculture");

  const INITIAL_VIEW_STATE = {
    longitude: 0,
    latitude: 20,
    zoom: viewMode === "globe" ? 10 : 2.3,
    transitionDuration: 1000,
  };

  const [searchValue, setSearchValue] = React.useState("");
  const [viewState, setViewState] = React.useState(INITIAL_VIEW_STATE);
  const [selectedRegion, setSelectedRegion] = React.useState<string>("");

  const [year, setYear] = React.useState(2023);
  const [tempYear, setTempYear] = React.useState(2023);
  const [tempMonth, setTempMonth] = React.useState(1);
  const [month, setMonth] = React.useState(1);
  const [playing, setPlaying] = React.useState(false);

  const [selectedDrought, setSelectedDrought] = React.useState<any>(null);

  //For Side-by-Side analysis deactivate back to landingpage
  const [sideBySide, setSideBySide] = React.useState(false);

  // Sync temporary year/month with selected values
  React.useEffect(() => {
    setTempYear(year);
  }, [year]);

  React.useEffect(() => {
    setTempMonth(month);
  }, [month]);


  React.useEffect(() => {
    // read URL-Parameter
    const params = new URLSearchParams(window.location.search);
    const sbs = params.get("sideBySide");

    // if true then activate sidebyside
    setSideBySide(sbs === "true");
  }, []);

  // --- STATE: AI CHAT ---
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([
    { role: "assistant", content: "Hello! I analyze the drought, crop yield, and temperature data you see. How can I help?" }
  ]);
  const [userMessage, setUserMessage] = React.useState("");
  const [isChatLoading, setIsChatLoading] = React.useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  const zoom = viewState.zoom ?? 1;
  const mapRef = React.useRef<any>(null);

  // --- Load Data ---
  const [droughtEventsRaw, setDroughtsRaw] = React.useState<any[]>([]);
  const [cerealYieldsRaw, setYieldsRaw] = React.useState<any[]>([]);
  const [temperatureRaw, setTemperatureRaw] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const iso2ToIso3 = React.useMemo(() => {
    const out: Record<string, string> = {};
    worldData.features.forEach((feature: any) => {
      const iso2 = feature?.properties?.iso_a2;
      const iso3 = getIsoFromFeature(feature);
      if (iso2 && iso2 !== "-99" && iso3) {
        out[String(iso2).toUpperCase()] = iso3;
      }
    });
    return out;
  }, []);

  const iso3ToRegion = React.useMemo(() => {
    const out: Record<string, string> = {};
    worldData.features.forEach((feature: any) => {
      const iso3 = getIsoFromFeature(feature);
      const region = feature?.properties?.continent;
      if (iso3 && region) {
        out[iso3] = String(region);
      }
    });
    return out;
  }, []);

  // --- CHAT LOGIC ---
  React.useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatOpen]);

  const resetChat = () => {
    setChatMessages([
      { role: "assistant", content: "Hello! I analyze the drought, crop yield, and temperature data you see. How can I help?" }
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

    // Context preparation — per-country temperature averages
    const countryTemps: Record<string, { sum: number; count: number }> = {};
    temperatureRaw.filter(d => d.tavg > -9990).forEach(d => {
        const iso2 = String(d.country || "").toUpperCase();
        const c = iso2ToIso3[iso2];
        if (!c) return;
        if (!countryTemps[c]) countryTemps[c] = { sum: 0, count: 0 };
        countryTemps[c].sum += d.tavg;
        countryTemps[c].count += 1;
    });

    const promptCountries = yieldsYearFiltered
      .filter(c => {
        const iso3 = String(c.CTY_CODE || "").trim().toUpperCase();
        if (!iso3 || iso3 === "UNKNOWN") return false;
        if (!selectedRegion) return true;
        return iso3ToRegion[iso3] === selectedRegion;
      });

    const topCountries = promptCountries.slice(0, 5).map(c => {
        const key = String(c.CTY_CODE || "").trim().toUpperCase();
        const tempEntry = countryTemps[key];
        const avgTemp = tempEntry ? (tempEntry.sum / tempEntry.count).toFixed(1) : "N/A";
        return `${c.Entity} (Yield: ${c["cereal_yield (tonnes per hectare)"]?.toFixed(1)} t/ha, Avg Temp: ${avgTemp}°C)`;
    }).join(", ");

    const systemContext = `
    You are a specialized AI assistant for a data visualization dashboard focused strictly on:
    - Global Drought Events (Intensity, Severity)
    - Crop Yields (Agricultural output)
    - Food Expenditures and Temperatures.

    You must NOT:
    - Don't ask about "providing pdf" or "give me pdf" or something. User interaction face not capable to do that.

    Current Dashboard State:
    - Year: ${year}
    - Month: ${MONTH_NAMES[month - 1]}
    - Layer Mode: ${layerMode} (Agriculture or Climate)
    - View Mode: ${viewMode}
    - Selected Region: ${selectedRegion || "Global"}
    - Top Visible Countries: ${topCountries}
    `;

    try {
      const response = await fetch(`${BACKEND}/api/openai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: newMessage.content,
          systemContext,
          year: year,
          month: month,
          layerMode: layerMode
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

  // --- EFFECTS: DATA SYNC ---
  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "VIEW_STATE") {
        setViewState(e.data.payload);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "TIME_STATE") {
        setYear(e.data.payload.year);
        setMonth(e.data.payload.month);
        setTempYear(e.data.payload.year);
        setTempMonth(e.data.payload.month);
        setPlaying(false);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const d = await fetch(`${BACKEND}/api/data/drought`).then(r => r.json());
        const y = await fetch(`${BACKEND}/api/data/yields`).then(r => r.json());
        const t = await fetch(`${BACKEND}/api/data/temperature?year=${year}&month=${month}`).then(r => r.json());

        setDroughtsRaw(d.drought);
        setYieldsRaw(y.yields);
        setTemperatureRaw(t.temperature);
      } catch (err) {
        console.error("Data loading failed:", err);
      }
    }
    load();
  }, [year, month]);

  React.useEffect(() => {
    if (droughtEventsRaw.length > 0 && cerealYieldsRaw.length > 0 && temperatureRaw.length > 0) {
      setLoading(false);
    }
  }, [droughtEventsRaw, cerealYieldsRaw, temperatureRaw]);

  // Animation
  React.useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setYear((y) => (y < 2023 ? y + 1 : 1961));
    }, 800);
    return () => clearInterval(interval);
  }, [playing]);

  // --- MEMOS & LAYERS ---
  const yieldsYearFiltered = React.useMemo(() => {
    return cerealYieldsRaw.filter((d) => d.Year === year);
  }, [cerealYieldsRaw, year]);

  const yieldByCountry = React.useMemo(() => {
    return Object.fromEntries(
      yieldsYearFiltered
        .map((d) => ({
          country: d.CTY_CODE,
          yield: d["cereal_yield (tonnes per hectare)"],
        }))
        .map((d) => [d.country, d.yield])
    );
  }, [yieldsYearFiltered]);

  const yieldsWithExpenditure = React.useMemo(() => {
    return addCoordinates(yieldsYearFiltered).map(d => ({
      ...d,
      expenditure: d["Total food expenditure"] || 0
    }));
  }, [yieldsYearFiltered]);

  const agriYears = React.useMemo(() => [2017, 2023], []);
  const climateYears = React.useMemo(() => [1951, 2016], []);
  const activeYears = React.useMemo(()=>{
    return layerMode === "agriculture" ? agriYears : climateYears;
  }, [layerMode, agriYears, climateYears]);
  React.useEffect(()=>{
    if (!activeYears) return;
    const [minYear, maxYear] = activeYears;

    let nextYear = year;

    if (year < minYear) nextYear = minYear;
    if (year > maxYear) nextYear = maxYear;

    setYear(nextYear);
    setTempYear(nextYear);

  },[layerMode]);

  const BASE_RADIUS = 20000;
  const radiusScale = React.useMemo(() => {
    const expenditures = yieldsWithExpenditure
      .filter(d => d.Year === year && d.expenditure > 0)
      .map(d => d.expenditure);
    const min = Math.min(...expenditures, 0);
    const max = Math.max(...expenditures, 1);
    return scaleSqrt().domain([min, max]).range([BASE_RADIUS, BASE_RADIUS * 4]).clamp(true);
  }, [yieldsWithExpenditure, year]);

  const zoomRadiusFactor = React.useMemo(() => {
    if (zoom <= 2) return 2.5;
    if (zoom <= 4) return 2.0;
    if (zoom <= 6) return 1.4;
    if (zoom <= 8) return 1.0;
    if (zoom <= 10) return 0.7;
    return 0.5;
  }, [zoom]);

  const handleSelectRegion = (region: string) => {
    setSelectedRegion(region);
    if (!region) {
      setViewState({
        longitude: 0,
        latitude: 20,
        zoom: viewMode === "globe" ? 10 : 2.3,
        transitionDuration: 1000
      });
      return;
    }
    const [minLon, minLat, maxLon, maxLat] = regions[region];
    setViewState({
      ...viewState,
      longitude: (minLon + maxLon) / 2,
      latitude: (minLat + maxLat) / 2,
      zoom: Math.min(4, 5 - Math.max((maxLon - minLon) / 50, (maxLat - minLat) / 50)),
      transitionDuration: 1000
    });
  };

  // --- FIX 2: OCEAN LAYER (Solid Background) ---
  // Using a solid polygon that covers the world to prevent see-through in Globe View
  const oceanLayer = React.useMemo(() => {
    return new GeoJsonLayer({
      id: "ocean-background",
      data: [{
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [-180, 90], [180, 90], [180, -90], [-180, -90], [-180, 90]
          ]]
        }
      }],
      filled: true,
      stroked: false,
      // Greyish blue/white similar to the map background
      getFillColor: [226, 232, 240, 255],
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
    });
  }, []);

  //Crop Yield Layer
  const countryLayer = React.useMemo(() => {
    if (loading) return null;
    const yieldValues = Object.values(yieldByCountry).map(v => Number(v)).filter(v => v > 0);
    const minYield = Math.min(...yieldValues);
    const maxYield = Math.max(...yieldValues);
    const yieldColorScale = scaleSequential(interpolateGreens).domain([minYield, maxYield]);

    return new GeoJsonLayer({
      id: "countries-" + year,
      data: worldData,
      pickable: true,
      stroked: true,
      filled: true,
      lineWidthMinPixels: 0.5,
      getLineColor: [120, 120, 120, 180],
      getFillColor: (f) => {
        const iso = getIsoFromFeature(f);
        const val = iso ? yieldByCountry[iso] ?? 0 : 0;
        if (val === 0) return [220, 220, 220, 80];
        const c = rgb(yieldColorScale(val));
        return [c.r, c.g, c.b, 200];
      },
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
    });
  }, [loading, yieldByCountry, year]);

  //Food Expenditure Layer
  const expenditureLayer = React.useMemo(() => {
    if (loading) return null;
    const values = yieldsWithExpenditure.map(d => d.expenditure || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const expenditureColorScale = scaleLinear<string>().domain([min, max]).range(["#ede9fe", "#4f46e5"]);

    return new ScatterplotLayer({
      id: "expenditure-layer-" + year,
      data: yieldsWithExpenditure.filter(d => d.Year === year),
      radiusMinPixels: 4,
      opacity: 0.8,
      getPosition: d => [d.lon, d.lat],
      getRadius: d => (d.expenditure === 0 ? BASE_RADIUS : radiusScale(d.expenditure) * zoomRadiusFactor),
      getFillColor: d => {
        const v = d.expenditure || 0;
        if (v === 0) return [239, 68, 68, 200];
        const c = rgb(expenditureColorScale(d.expenditure));
        return [c.r, c.g, c.b, 200];
      },
      radiusMaxPixels: 120,
      stroked: true,
      getLineColor: [255, 255, 255, 100],
      lineWidthMinPixels: 0.5,
      pickable: true,
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
    });
  }, [loading, yieldsWithExpenditure, year, radiusScale, zoomRadiusFactor]);

  const pulse = 1 + 0.3*Math.sin(Date.now() / 400);
  //Drought Events Layer
  const droughtScatterLayer = React.useMemo(() => {
    if (loading || !droughtEventsRaw || droughtEventsRaw.length === 0) return null;
    const droughtProcessed = addCoordinatesToDroughts(droughtEventsRaw);
    const droughtActive = filterDroughtsForMonth(droughtProcessed, year, month);

    return new ScatterplotLayer({
      id: "drought-scatter-" + year + "-" + month,
      data: droughtActive,
      pickable: true,
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      getPosition: (d) => [d.lon, d.lat],
      getRadius: (d) => 70000 * pulse * Math.sqrt(d.intensity || 1),
      radiusMinPixels: 6,
      stroked: true,
      getLineColor: [0,0,0,200],
      lineWidthMinPixels:2,
      getFillColor: (d) => {
        const c = rgb(severityColorScale(d.severity || 0));
        return [c.r, c.g, c.b, 220];
      },
      getOpacity: (d) => Math.min((d.score || 1) / 10, 1),
      onClick: (info) => {
        if (info?.object) setSelectedDrought(info.object);
      }
    });
  }, [loading, droughtEventsRaw, year, month]);

  const tempColorScale = scaleLinear<string>().domain([-20, 35]).range(['#1e40af', '#ef4444']).clamp(true);

  // Temperature Data Layer
  const temperatureScatterLayer = React.useMemo(() => {
    if (loading) return null;
    return new ScatterplotLayer({
      id: "temperature-scatter-" + year + "-" + month,
      data: temperatureRaw.filter(d => d.tavg > -9990),
      pickable: true,
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      getPosition: d => [d.lng, d.lat],
      getRadius: d => {
        if (zoom <= 3) return 12000;
        if (zoom <= 7) return 45000;
        if (zoom <= 10) return 150000;
        return 200000;
      },
      getOpacity: 0.35,
      radiusMinPixels: 3,
      getFillColor: d => {
        if (d.tavg === -9999) return [0, 0, 0, 0];
        const c = rgb(tempColorScale(d.tavg));
        return [c.r, c.g, c.b, 180];
      },
    });
  }, [loading, temperatureRaw, year, month, tempColorScale, zoom]);

  const countryOutlineLayer = React.useMemo(() => {
    if (loading) return null;
    return new GeoJsonLayer({
      id: "country-outline",
      data: worldData,
      filled: false,
      stroked: true,
      getLineColor: [50, 50, 50, 200],
      lineWidthMinPixels: 1,
      pickable: false,
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
    });
  }, [loading]);


  const layers = React.useMemo(() => {
    if (loading || !countryLayer) return [];

    // Always include oceanLayer first to prevent look-through
    const baseLayers = [oceanLayer];

    if (layerMode === "agriculture") {
      return [...baseLayers, countryLayer, expenditureLayer, countryOutlineLayer];
    }
    if (layerMode === "climate") {
      return [...baseLayers, temperatureScatterLayer, droughtScatterLayer];
    }
    return [...baseLayers, countryLayer, countryOutlineLayer];
  }, [loading, layerMode, oceanLayer, expenditureLayer, countryLayer, countryOutlineLayer, droughtScatterLayer, temperatureScatterLayer]);

  React.useEffect(() => {
    if (!mapRef.current) return;
    if (viewMode === "globe") {
      const overlay = new MapboxOverlay({ layers });
      mapRef.current.addControl(overlay);
      return () => mapRef.current.removeControl(overlay);
    }
  }, [viewMode, layers]);

  const glParameters: WebGLParameters = {
    cull: true
  };
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "#f0fdf4", overflow: "hidden", fontFamily: "system-ui, sans-serif", display: "flex" }}>

      {/* HEADER */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", zIndex: 10, pointerEvents: "none", padding: "2rem" }}>
        <div style={{ maxWidth: "600px", pointerEvents: "auto" }}>
          {!sideBySide && (
            <Link
              to="/"
              style={{
                fontSize: "0.9rem",
                color: "#047857",
                textDecoration: "none",
                fontWeight: "bold",
              }}
            >
              ← Back to Landingpage
            </Link>
          )}
          <h1 style={{ fontSize: "2.2rem", margin: "0.5rem 0", fontWeight: 700, color: "#064e3b" }}>Drought & Yield Map</h1>
        </div>
      </div>

      {/* MAP AREA */}
      <div style={{ flex: 1, position: "relative", height: "100%" }}>
        {loading && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontWeight: "bold", color: "#065f46", zIndex: 100 }}>Loading Data...</div>}

        <DeckGL
          views={viewMode === "globe" ? new GlobeView({ controller: GlobeController, backgroundColor: [0, 128, 0, 255] }) : undefined}
          controller={true}
          viewState={viewState}
          onViewStateChange={({ viewState }) => {
            setViewState(viewState);
            if (window.self !== window.top) {
              window.parent.postMessage({ type: "VIEW_STATE", payload: viewState, source: "local" }, "*");
            }
          }}
          layers={layers}
          glOptions={{ alpha: false }}
          parameters={glParameters}
          // --- FIX 1: CUSTOM WHITE TOOLTIP STYLE ---
          getTooltip={({ object, layer }) => {
            if (!object || !layer) return null;

            let content = "";

            if (layerMode === "agriculture" && (layer.id.startsWith("countries") || layer.id.startsWith("expenditure-layer"))) {
              const iso = object.CTY_CODE?.trim().toUpperCase() ?? getIsoFromFeature(object);
              const countryFeature = worldData.features.find(f => getIsoFromFeature(f) === iso);
              const countryName = object.properties?.name ?? countryFeature?.properties?.name ?? iso;
              const match = yieldsWithExpenditure.find(d => d.CTY_CODE === iso);
              const yieldVal = yieldByCountry[iso];
              const expenditureVal = match?.expenditure ?? object.expenditure;

              content = `
                  <div style="margin-bottom:4px; font-weight:700; font-size:1rem; color:#111827;">${countryName ?? iso}</div>
                  <div style="font-size:0.85rem; color:#4b5563; margin-bottom:8px;">Year: ${year}</div>
                  <div style="font-size:0.85rem; color:#065f46; font-weight:600;">🌾 Yield: ${yieldVal !== undefined ? yieldVal.toFixed(2) + " t/ha" : "no data"}</div>
                  <div style="font-size:0.85rem; color:#4338ca; font-weight:600;">💰 Food Expenditure: ${expenditureVal !== undefined || !isNaN(expenditureVal) ? expenditureVal.toLocaleString() + " USD" : "no data"}</div>
              `;
            } else if (layerMode === "climate" && layer.id.startsWith("drought-scatter")) {
              const iso = object.CTY_CODE?.trim().toUpperCase();
              const countryFeature = worldData.features.find(f => getIsoFromFeature(f) === iso);
              const countryName = countryFeature?.properties?.name ?? iso;
              content = `
                  <div style="margin-bottom:4px; font-weight:700; font-size:1rem; color:#b91c1c;">Drought Event</div>
                  <div style="font-size:0.85rem; color:#374151;"><b>Country:</b> ${countryName}</div>
                  <div style="font-size:0.85rem; color:#374151;"><b>Intensity:</b> ${object.INTENSITY}</div>
                  <div style="font-size:0.85rem; color:#374151;"><b>Severity:</b> ${object.SEVERITY}</div>
                  <div style="font-size:0.85rem; color:#374151;"><b>Duration:</b> ${object.DURATION} months</div>
                  <div style="font-size:0.85rem; color:#374151;"><b>Score:</b> ${object.SCORE}</div>
              `;
            } else {
              return null;
            }

            return {
              html: content,
              style: {
                backgroundColor: "white",
                color: "black",
                fontSize: "0.85rem",
                borderRadius: "8px",
                padding: "12px",
                boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
                maxWidth: "300px",
                border: "1px solid #e5e7eb"
              }
            };
          }}
        >
          <Map
            reuseMaps
            mapLib={maplibregl}
            mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            projection={viewMode === "globe" ? "globe" : "mercator"}
          />
        </DeckGL>
      </div>

      {/* AI CHAT PANEL */}
      {isChatOpen && (
        <div style={{
          width: "350px",
          height: "100vh",
          backgroundColor: "#f0fdf4",
          borderRight: "1px solid #a7f3d0",
          display: "flex",
          flexDirection: "column",
          zIndex: 49,
          boxShadow: "-2px 0 10px rgba(0,0,0,0.05)",
          position: "fixed",
          right: "400px",
          top: 0
        }}>
          <div style={{ padding: "1rem", borderBottom: "1px solid #a7f3d0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#d1fae5" }}>
            <span style={{ fontWeight: "bold", color: "#064e3b" }}>AI Data Assistant 🤖</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button onClick={resetChat} style={{ border: "1px solid #a7f3d0", background: "white", borderRadius: "10px", padding: "6px 10px", cursor: "pointer", color: "#064e3b", fontWeight: 700, fontSize: "0.8rem" }} title="Clear">
                🧹 Clear
              </button>
              <button onClick={() => setIsChatOpen(false)} style={{ border: "none", background: "transparent", fontSize: "1.2rem", cursor: "pointer", color: "#064e3b" }} title="Close">
                ×
              </button>
            </div>
          </div>

          <div style={{ flex: 1, padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                background: msg.role === "user" ? "#059669" : "white",
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
            {isChatLoading && <div style={{ alignSelf: "flex-start", color: "#6b7280", fontSize: "0.8rem", fontStyle: "italic" }}>AI analyzing data...</div>}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: "1rem", borderTop: "1px solid #a7f3d0", display: "flex", gap: "0.5rem", background: "white" }}>
            <input
              type="text"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask about drought trends..."
              style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: "6px", padding: "8px", fontSize: "0.9rem", outline: "none" }}
            />
            <button onClick={handleSendMessage} style={{ background: "#059669", color: "white", border: "none", borderRadius: "6px", padding: "0 14px", cursor: "pointer", fontSize: "1.1rem" }}>➤</button>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "400px",
          height: "100vh",
          backgroundColor: "white",
          borderLeft: "1px solid #a7f3d0",
          boxShadow: "-4px 0 15px rgba(0,0,0,0.05)",
          padding: "2rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.2rem",
          fontSize: "0.9rem",
          zIndex: 50,
          position: "relative",
          overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* FIX 3: BUTTON FLEX & WRAPPING */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            style={{
              background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
              border: "none",
              borderRadius: "20px",
              padding: "0.5rem 1rem",
              color: "white",
              fontWeight: "bold",
              fontSize: "0.8rem",
              cursor: "pointer",
              boxShadow: "0 4px 6px rgba(13, 148, 136, 0.3)",
              transition: "transform 0.1s",
              whiteSpace: "nowrap",
              minWidth: "fit-content",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px"
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.95)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            {isChatOpen ? "Close AI" : "Chat With AI ✨"}
          </button>

          <div style={{ textAlign: "right", marginLeft: "10px" }}>
            <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#047857" }}>Interactions</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#064e3b" }}>Linking, Brushing & Filtering</div>
          </div>
        </div>

        {/* Map / Globe Switch */}
        <button
          onClick={() => setViewMode(viewMode === "map" ? "globe" : "map")}
          style={{
            width: "100%",
            padding: "0.4rem 0.6rem",
            borderRadius: "99px",
            border: "1px solid #a7f3d0",
            background: "#f0fdf4",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#064e3b",
            textAlign: "center",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#dcfce7"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#f0fdf4"; }}
        >
          {viewMode === "map" ? "🌍 Globe View" : "🗺️ Map View"}
        </button>

        {/* Search */}
        <div>
          <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#047857", marginBottom: "0.4rem" }}>Search Country</div>
          <input
            placeholder="Type a country name…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const feature = worldData.features.find(f => f.properties?.name?.toLowerCase() === searchValue.toLowerCase());
              if (!feature) return;
              const center =  getMainlandCentroid(feature).geometry.coordinates;
              setViewState({ ...viewState, longitude: center[0], latitude: center[1], zoom: 4, pitch: 20, transitionDuration: 1000, transitionInterpolator: new FlyToInterpolator() });
            }}
            style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1px solid #a7f3d0", backgroundColor: "#ecfdf5", color: "#064e3b", fontWeight: 500, outline: "none", boxShadow: "inset 0 0 0 1px rgba(5,150,105,0.1)" }}
          />
        </div>

        {/* Switch Layer Mode */}
        <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#047857", marginBottom: "0.5rem" }}>Layer Mode</div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button onClick={() => setLayerMode("agriculture")} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: layerMode === "agriculture" ? "2px solid #047857" : "1px solid #ccc", background: layerMode === "agriculture" ? "#ecfdf5" : "white", cursor: "pointer", color: "#064e3b", fontWeight: layerMode === "agriculture" ? 700 : 400 }}>
            🌾 Crop Yields & 💰 Food Prices
          </button>
          <button onClick={() => setLayerMode("climate")} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: layerMode === "climate" ? "2px solid #b91c1c" : "1px solid #ccc", background: layerMode === "climate" ? "#fef2f2" : "white", cursor: "pointer", color: "#c2410c", fontWeight: layerMode === "climate" ? 700 : 400 }}>
            🌵 Drought & 🌡️ Temperature
          </button>
        </div>

        {/* Select Region */}
        <div>
          <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#047857", marginBottom: "0.5rem" }}>Regions</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {Object.keys(regions).map(region => {
              const active = selectedRegion === region;
              return (
                <button key={region} onClick={() => handleSelectRegion(region)} style={{ padding: "10px", borderRadius: "10px", border: active ? "2px solid #047857" : "1px solid #d1fae5", backgroundColor: active ? "#ecfdf5" : "#f0fdf4", color: "#064e3b", fontWeight: active ? 700 : 500, cursor: "pointer", transition: "all 0.2s ease" }}>
                  {region}
                </button>
              );
            })}
            <button onClick={() => handleSelectRegion("")} style={{ gridColumn: "span 2", padding: "10px", borderRadius: "10px", border: "1px dashed #a7f3d0", backgroundColor: "#f0fdf4", color: "#047857", fontWeight: 600, cursor: "pointer" }}>
              Reset Region
            </button>
          </div>
        </div>

        {/* TIMELINE */}
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "12px", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          {/* YEAR */}
          {(() => {
            const years = layerMode === "agriculture" ? agriYears : climateYears;
            if (!years) return <div style={sectionValueStyle}>Loading...</div>;
            return (
              <div>
                <div style={sectionTitleStyle}>Year</div>
                <div style={sectionValueStyle}>{tempYear}</div>
                <input
                  type="range" min={activeYears[0]} max={activeYears[1]} value={tempYear}
                  onChange={(e) => setTempYear(Number(e.target.value))}
                  onMouseUp={() => { setYear(tempYear); setPlaying(false); if (window.self !== window.top) { window.parent.postMessage({ type: "TIME_STATE", payload: { year: tempYear, month }, source: "local" }, "*"); } }}
                  onTouchEnd={() => { setYear(tempYear); setPlaying(false); if (window.self !== window.top) { window.parent.postMessage({ type: "TIME_STATE", payload: { year: tempYear, month }, source: "local" }, "*"); } }}
                  style={{ width: "100%", accentColor: "#059669", cursor: "pointer" }}
                />
              </div>
            );
          })()}

          {/* MONTH – ONLY FOR CLIMATE */}
          {layerMode === "climate" && (
            <div>
              <div style={sectionTitleStyle}>Month</div>
              <div style={sectionValueStyle}>{MONTH_NAMES[tempMonth - 1]}</div>
              <input
                type="range" min={1} max={12} value={tempMonth}
                onChange={(e) => setTempMonth(Number(e.target.value))}
                onMouseUp={() => { setMonth(tempMonth); setPlaying(false); if (window.self !== window.top) { window.parent.postMessage({ type: "TIME_STATE", payload: { year, month: tempMonth }, source: "local" }, "*"); } }}
                onTouchEnd={() => { setMonth(tempMonth); setPlaying(false); if (window.self !== window.top) { window.parent.postMessage({ type: "TIME_STATE", payload: { year, month: tempMonth }, source: "local" }, "*"); } }}
                style={{ width: "100%", accentColor: "#0ea5e9", cursor: "pointer" }}
              />
            </div>
          )}
        </div>

        {/* SELECTED DROUGHT DETAILS */}
        {selectedDrought && (
          (() => {
            const iso = selectedDrought.CTY_CODE?.trim().toUpperCase();
            const countryFeature = worldData.features.find(f => getIsoFromFeature(f) === iso);
            const countryName = countryFeature?.properties?.name ?? iso;

            return (
              <div style={{
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: "12px",
                padding: "0.8rem",
                boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem"
              }}>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, color: "#c2410c" }}>
                  Drought Details
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#7c2d12" }}>
                  {countryName}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280", lineHeight: 1.4 }}>
                  <div><b>From:</b> {selectedDrought.START_DATE}  <b>To:</b> {selectedDrought.END_DATE}</div>
                  <div><b>Peak:</b> {selectedDrought.PEAK_DATE}</div>
                  <div><b>Duration:</b> {selectedDrought.DURATION} months</div>
                </div>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#b91c1c", lineHeight: 1.4 }}>
                  <div>Severity: {selectedDrought.SEVERITY}</div>
                  <div>Intensity: {selectedDrought.INTENSITY}</div>
                  <div>Score: {selectedDrought.SCORE}</div>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#374151", lineHeight: 1.4, marginTop: "0.2rem" }}>
                  <div><b>Average Area:</b> {selectedDrought.AVERAGE_AREA}%</div>
                  <div><b>Widest Area:</b> {selectedDrought.WIDEST_AREA_PERC}%</div>
                </div>
                <button onClick={() => setSelectedDrought(null)} style={{ marginTop: "10px", padding: "8px", width: "100%", background: "#eee", border: "1px solid #ccc", color: "#b91c1c", borderRadius: "6px" }}>
                  Clear
                </button>
              </div>
            )
          })()
        )}
      </div>

      {/* LEGEND – Mode dependent */}
      <div style={{ position: "absolute", bottom: "24px", left: "24px", zIndex: 20, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(6px)", borderRadius: "14px", padding: "14px 16px", width: "260px", boxShadow: "0 20px 40px rgba(0,0,0,0.12)", fontSize: "0.8rem", color: "#064e3b", pointerEvents: "auto" }}>
        {layerMode === "agriculture" && (
          <>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#047857" }}>Agriculture</div>
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontWeight: 600, marginBottom: "6px" }}>Crop Yield (t / ha)</div>
              <div style={{ height: "10px", borderRadius: "999px", background: "linear-gradient(90deg, #dcfce7, #22c55e, #166534)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginTop: "4px", color: "#065f46" }}><span>Low</span><span>High</span></div>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: "6px" }}>Food Expenditure per Person</div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#ef4444" }} />
                <span style={{ fontSize: "0.75rem" }}>0 USD / No data</span>
              </div>
              <div style={{ height: "10px", borderRadius: "999px", background: "linear-gradient(90deg, #ede9fe, #4f46e5)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginTop: "4px", color: "#4338ca" }}><span>Low</span><span>High</span></div>
            </div>
          </>
        )}

        {layerMode === "climate" && (
          <>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#065f46" }}>Climate</div>
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontWeight: 600, marginBottom: "6px" }}>Temperature (°C)</div>
              <div style={{ height: "10px", borderRadius: "999px", background: "linear-gradient(90deg, #1e40af, #3b82f6, #22d3ee, #84cc16, #facc15, #ef4444)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginTop: "4px", color: "#065f46" }}><span>-20°C</span><span>35°C</span></div>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontWeight: 600, marginBottom: "6px" }}>
                Drought Intensity (Point Size)
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#b91c1c" }} />
                <span style={{ fontSize: "0.7rem" }}>Low</span>

                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#b91c1c" }} />
                <span style={{ fontSize: "0.7rem" }}>Medium</span>

                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#b91c1c" }} />
                <span style={{ fontSize: "0.7rem" }}>High</span>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: "6px" }}>Drought Severity (Color)</div>
              <div style={{ height: "10px", borderRadius: "999px", background: "linear-gradient(90deg, #fff7ed, #fed7aa, #fb923c, #ef4444, #7f1d1d)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginTop: "4px", color: "#7c2d12" }}><span>Low</span><span>Extreme</span></div>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontWeight: 600, marginBottom: "6px" }}>
                Drought Score (Opacity)
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#b91c1c", opacity: 0.3 }} />
                <span style={{ fontSize: "0.7rem" }}>0-7 Moderate drought event</span>

                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#b91c1c", opacity: 0.6 }} />
                <span style={{ fontSize: "0.7rem" }}>8-11 Severe drought event</span>

                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#b91c1c", opacity: 1 }} />
                <span style={{ fontSize: "0.7rem" }}>12-25 Exceptional drought event</span>
              </div>

              <div style={{ fontSize: "0.65rem", marginTop: "4px", color: "#6b7280" }}>
                Score combines severity, duration and affected area
              </div>
            </div>
            <div style={{
              marginTop: "12px",
              paddingTop: "8px",
              borderTop: "1px dashed #d1d5db",
              fontSize: "0.75rem",
              color: "#374151"
            }}>
              Click on a drought event point to view detailed information
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MapGlobeSwitcher;
