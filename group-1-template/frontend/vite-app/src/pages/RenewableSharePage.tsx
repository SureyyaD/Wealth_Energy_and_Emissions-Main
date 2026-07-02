import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Map, { Source, Layer, NavigationControl, MapRef } from "react-map-gl/maplibre";
import 'maplibre-gl/dist/maplibre-gl.css';

const BACKEND = import.meta.env.VITE_BACKEND_API_URL;

// CSV parsing helper
const parseCSV = (text: string) => {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row);
    }
  }
  
  return rows;
};

// --- CONFIGURATION ---

// --- TYPES & DATA ---
type Region = "europe" | "asia" | "americas";
type ChatMessage = {
    role: "user" | "assistant" | "system";
    content: string;
};

// Region mapping helper - Determine region based on ISO codes
const getRegionByCode = (iso3: string | undefined, iso2: string | undefined, admin: string | undefined): Region | null => {
  if (!iso3 && !iso2 && !admin) {
    return null;
  }
  
  const code = (iso3 || iso2 || "").toUpperCase().trim();
  const name = (admin || "").toLowerCase().trim();
  
  // Skip invalid ISO codes (-99, -1, etc.)
  const isValidCode = code && code !== "-99" && code !== "-1" && !code.startsWith("-") && code.length > 0;
  
  // Special handling for France and Norway (common problematic cases)
  if (name) {
    if (name.includes("france") || name === "fra" || code === "FRA" || code === "FR") {
      return "europe";
    }
    if (name.includes("norway") || name === "nor" || code === "NOR" || code === "NO") {
      return "europe";
    }
  }
  
  // Europe
  const europeCodes = ["ALB", "AND", "AUT", "FRA", "NOR", "BEL", "BIH", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "DEU", "GRC", "HUN", "ISL", "IRL", "ITA", "LVA", "LIE", "LTU", "LUX", "MLT", "MDA", "MCO", "MNE", "NLD", "MKD", "NOR", "POL", "PRT", "ROU", "RUS", "SMR", "SRB", "SVK", "SVN", "ESP", "SWE", "CHE", "UKR", "GBR", "VAT"];
  const europeNames = ["europe", "european", "euro", "turkey", "turkiye"];
  const europeCountryNames = ["france", "norway", "germany", "spain", "italy", "united kingdom", "uk", "poland", "netherlands", "belgium", "greece", "portugal", "sweden", "denmark", "finland", "austria", "switzerland", "czech", "romania", "hungary", "ireland", "croatia", "bulgaria", "slovakia", "slovenia", "lithuania", "latvia", "estonia", "cyprus"];
  
  // Asia
  const asiaCodes = ["AFG", "ARM", "AZE", "BHR", "BGD", "BTN", "BRN", "KHM", "CHN", "GEO", "HKG", "IND", "IDN", "IRN", "IRQ", "ISR", "JPN", "JOR", "KAZ", "KWT", "KGZ", "LAO", "LBN", "MAC", "MYS", "MDV", "MNG", "MMR", "NPL", "PRK", "OMN", "PAK", "PSE", "PHL", "QAT", "SAU", "SGP", "KOR", "LKA", "SYR", "TWN", "TJK", "THA", "TLS", "TUR", "TKM", "ARE", "UZB", "VNM", "YEM"];
  const asiaNames = ["asia", "asian", "middle east", "central asia", "south asia", "east asia", "southeast asia"];
  
  // Americas
  const americasCodes = ["AIA", "ATG", "ARG", "ABW", "BHS", "BRB", "BLZ", "BMU", "BOL", "BES", "VGB", "CAN", "CYM", "CHL", "COL", "CRI", "CUB", "CUW", "DMA", "DOM", "ECU", "SLV", "FLK", "GUF", "GRL", "GRD", "GLP", "GTM", "GUY", "HTI", "HND", "JAM", "MTQ", "MEX", "MSR", "NIC", "PAN", "PRY", "PER", "PRI", "BLM", "KNA", "LCA", "MAF", "SPM", "VCT", "SXM", "SUR", "TTO", "TCA", "USA", "URY", "VEN", "VGB", "VIR"];
  const americasNames = ["america", "american", "north america", "south america", "central america", "caribbean", "latin america"];
  
  // Check by valid ISO code first
  if (isValidCode) {
    if (europeCodes.includes(code)) return "europe";
    if (asiaCodes.includes(code)) return "asia";
    if (americasCodes.includes(code)) return "americas";
  }
  
  // Check by region name keywords
  if (europeNames.some(n => name.includes(n)) || europeCountryNames.some(n => name.includes(n))) {
    return "europe";
  }
  if (asiaNames.some(n => name.includes(n))) {
    return "asia";
  }
  if (americasNames.some(n => name.includes(n))) {
    return "americas";
  }
  
  return null;
};

type CountryPoint = {
  id: string;
  name: string;
  code: string;
  lat: number;
  lon: number;
  renewableShare: number | null; // null = no data
  fossilShare: number;
  co2_per_capita: number | null; // CO2 per capita in tons
  population: number | null; // Population in millions or raw number
  gdp: number | null; // Total GDP (null if no data)
  gdp_per_capita: number; // GDP per capita (0 if no data)
  region: Region | null;
  greenSize: number;
  redSize: number;
};

const INITIAL_VIEW_STATE = {
  latitude: 20,
  longitude: 0,
  zoom: 3
};

// Region centers for camera movement
const regionCenters: Record<string, { lng: number; lat: number; zoom: number }> = {
  europe:   { lng: 15, lat: 50, zoom: 2.2 },
  asia:     { lng: 90, lat: 30, zoom: 2.0 },
  americas: { lng: -80, lat: 15, zoom: 2.0 },
};

export default function RenewableSharePage() {
  const mapRef = useRef<MapRef>(null);

  // --- STATE ---
  const [hoveredInfo, setHoveredInfo] = useState<any>(null);
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null);
  
  // Data loading states
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [mergedGeoJson, setMergedGeoJson] = useState<any>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [mode, setMode] = useState<"renewable" | "co2_per_capita">("renewable");
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [minRenewable, setMinRenewable] = useState(0);
  const [maxRenewable, setMaxRenewable] = useState(100);
  const [regionFilter, setRegionFilter] = useState<Region | "all">("all");
  const [firstSymbolLayerId, setFirstSymbolLayerId] = useState<string | undefined>(undefined);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isBrushing, setIsBrushing] = useState(false);
  const [brushStart, setBrushStart] = useState<{ x: number; y: number } | null>(null);
  const [brushEnd, setBrushEnd] = useState<{ x: number; y: number } | null>(null);

  // --- AI CHAT STATE ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
      { role: "assistant", content: "Hello! I analyze the energy transition & CO2 data you see on the screen. How can I help?" }
  ]);
  const [userMessage, setUserMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  //For Side-by-side
  const [sideBySide, setSideBySide] = useState(false);
  const isExternalMoveRef = useRef(false);
  useEffect(() => {
    //  read URL-Parameter
    const params = new URLSearchParams(window.location.search);
    const sbs = params.get("sideBySide");

    // if true activate side by side
    setSideBySide(sbs === "true");
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== "VIEW_STATE") return;
      if (!mapRef.current) return;

      const map = mapRef.current.getMap();
      const { longitude, latitude, zoom, bearing, pitch } = e.data.payload || {};
      isExternalMoveRef.current = true;

      map.stop();
      map.easeTo({
        center: [
          longitude ?? map.getCenter().lng,
          latitude ?? map.getCenter().lat
        ],
        zoom: zoom ?? map.getZoom(),
        bearing: bearing ?? map.getBearing(),
        pitch: pitch ?? map.getPitch(),
        duration: 800
      });
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

    // Sync year from parent
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== "TIME_STATE") return;

      const { year } = e.data.payload || {};
      if (!year) return;

      if (availableYears.includes(year)) {
        setSelectedYear(year);
      }

      //setIsPlaying(false);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [availableYears]);


  // --- DATA LOADING ---
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Load CSV from backend API
        const csvResponse = await fetch(`${BACKEND}/api/data/renewables-csv`);
        if (!csvResponse.ok) {
          throw new Error(`CSV fetch failed: ${csvResponse.status}`);
        }
        const csvText = await csvResponse.text();
        const parsed = parseCSV(csvText);
        setCsvRows(parsed);
        
        // Get available years
        const years = [...new Set(parsed.map((r: any) => parseInt(r.Year || '0')))].filter(y => y > 0).sort((a, b) => a - b);
        setAvailableYears(years);
        if (years.length > 0 && !selectedYear) {
          const defaultYear = years[years.length - 1];
          setSelectedYear(defaultYear);
        }
        
        // 2. Load GeoJSON from backend API
        const geoResponse = await fetch(`${BACKEND}/api/data/geo-json`);
        if (!geoResponse.ok) {
          throw new Error(`GeoJSON fetch failed: ${geoResponse.status}`);
        }
        const geo = await geoResponse.json();
        setGeoJsonData(geo);
        
      } catch (error) {
        // Silent error handling
        console.error("Error loading data:", error);
      }
    };
    
    loadData();
  }, []);

  // --- Latest Year Selection & Calculations ---
  const latestByCountry = useMemo(() => {
    if (!csvRows.length || !selectedYear) {
      return {};
    }
    
    const latest: Record<string, any> = {};
    
    // Filter by selected year and get latest for each country
    const yearData = csvRows.filter((r: any) => parseInt(r.Year || '0') === selectedYear);
    
    yearData.forEach((r: any) => {
      const code = r.Code?.toUpperCase() || '';
      if (!code) return;
      
      const renewableShare = parseFloat(r.Renewables_share || '0');
      const population = parseFloat(r.population || '0');
      const gdp = parseFloat(r.gdp || '0');
      const co2 = parseFloat(r.co2 || '0');
      
      // Calculations
      const co2_intensity = gdp > 0 ? co2 / gdp : null;
      const co2_per_capita = population > 0 ? (co2 * 1000000) / population : 0;
      const gdp_per_capita = (population > 0 && gdp > 0) ? gdp / population : 0;
      
      latest[code] = {
        ...r,
        renewableShare,
        population,
        gdp,
        co2,
        co2_intensity,
        co2_per_capita,
        gdp_per_capita,
        year: parseInt(r.Year || '0')
      };
    });
    
    // Debug: Check Norway data
    if (latest['NOR']) {
      console.log('✅ Norway found in latestByCountry:', latest['NOR']);
    } else {
      console.log('❌ Norway NOT found in latestByCountry. Available codes:', Object.keys(latest).filter(k => k.includes('NOR') || k.includes('Norway')));
    }
    
    return latest;
  }, [csvRows, selectedYear]);

  // --- Merge CSV data into GeoJSON features ---
  useEffect(() => {
    if (!geoJsonData || !latestByCountry) {
      return;
    }
    
    const regionStats: Record<string, number> = { europe: 0, asia: 0, americas: 0, null: 0 };
    
    const merged = {
      ...geoJsonData,
      features: geoJsonData.features.map((f: any) => {
        const iso3 = f.properties?.iso_a3 || f.properties?.ISO_A3;
        const iso2 = f.properties?.iso_a2 || f.properties?.ISO_A2;
        const admin = f.properties?.admin || f.properties?.ADMIN;
        
        // Try multiple matching strategies
        let data = latestByCountry[iso3] || latestByCountry[iso2];
        
        // If no match by ISO code, try by entity name (normalized)
        if (!data && admin) {
          const normalizedAdmin = admin.toLowerCase().trim();
          data = Object.values(latestByCountry).find((d: any) => {
            if (!d.Entity) return false;
            const normalizedEntity = d.Entity.toLowerCase().trim();
            return normalizedEntity === normalizedAdmin || 
                   normalizedEntity.includes(normalizedAdmin) ||
                   normalizedAdmin.includes(normalizedEntity);
          });
        }
        
        // Special cases for countries with invalid ISO codes
        if (!data && admin) {
          const adminUpper = admin.toUpperCase();
          // Norway - check if name contains Norway or if ISO codes are invalid
          if (adminUpper.includes('NORWAY') || 
              (iso3 === '-99' || iso3 === '-1' || !iso3) && adminUpper.includes('NOR')) {
            data = latestByCountry['NOR'] || latestByCountry['NO'];
          }
          // France - check if name contains France or if ISO codes are invalid
          else if (adminUpper.includes('FRANCE') || 
                   (iso3 === '-99' || iso3 === '-1' || !iso3 || iso3 === 'FRA') && 
                   (adminUpper.includes('FRANCE') || adminUpper.includes('FR'))) {
            data = latestByCountry['FRA'] || latestByCountry['FR'];
          }
        }
        
        const featureId = f.id || iso3 || iso2 || admin || null;
        
        const region = getRegionByCode(iso3, iso2, admin);
        const regionKey = region || "null";
        regionStats[regionKey] = (regionStats[regionKey] || 0) + 1;
        
        return {
          ...f,
          id: featureId, 
          properties: {
            ...f.properties,
            ...(data || {}),
            id: featureId, 
            region: region || null 
          }
        };
      })
    };
    
    // Debug: Check Norway in mergedGeoJson
    const norwayFeature = merged.features.find((f: any) => {
      const iso3 = f.properties?.iso_a3 || f.properties?.ISO_A3;
      const admin = f.properties?.admin || f.properties?.ADMIN;
      return iso3 === 'NOR' || admin?.toLowerCase().includes('norway');
    });
    if (norwayFeature) {
      console.log('✅ Norway feature found in mergedGeoJson:', {
        iso3: norwayFeature.properties?.iso_a3,
        admin: norwayFeature.properties?.admin,
        renewableShare: norwayFeature.properties?.renewableShare,
        population: norwayFeature.properties?.population
      });
    } else {
      console.log('❌ Norway feature NOT found in mergedGeoJson');
    }
    
    setHoveredInfo(null);
    setHoveredFeatureId(null);
    setMergedGeoJson(merged);
  }, [geoJsonData, latestByCountry]);

  // --- Reset filters when mode changes ---
  useEffect(() => {
    if (mode === "renewable") {
      setMinRenewable(0);
      setMaxRenewable(100);
    } else {
      // For CO2 per capita, use higher default max to include high-emission countries (e.g., Bahrain, Qatar)
      setMinRenewable(0);
      setMaxRenewable(50); // Increased from 20 to 50 to include high CO2 per capita countries
    }
  }, [mode]);

  // --- FILTER LOGIC - Create country list from mergedGeoJson ---
  const filteredCountries = useMemo(() => {
    if (!mergedGeoJson || !mergedGeoJson.features) {
      return [];
    }
    
    const countryMap: Record<string, CountryPoint> = {};
    
    mergedGeoJson.features.forEach((feature: any) => {
      const props = feature.properties || {};
      const iso3 = props.iso_a3 || props.ISO_A3;
      const iso2 = props.iso_a2 || props.ISO_A2;
      const admin = props.admin || props.ADMIN || props.Entity;
      const name = admin || props.name || props.NAME || "Unknown";
      
      // Debug: Check if this is Norway
      const isNorway = name.toLowerCase().includes('norway') || iso3 === 'NOR' || iso2 === 'NO';
      
      // Skip invalid ISO codes like '-99' and use name as fallback
      const countryKey = (iso3 && iso3 !== '-99' && iso3 !== '-1') ? iso3.toUpperCase() :
                         (iso2 && iso2 !== '-99' && iso2 !== '-1') ? iso2.toUpperCase() :
                         name.toUpperCase();
      
      if (isNorway) {
        console.log('🔍 Norway processing, countryKey:', countryKey, 'iso3:', iso3, 'iso2:', iso2, 'name:', name, 'renewableShare:', props.renewableShare);
      }
      
      if (countryMap[countryKey]) {
        const existing = countryMap[countryKey];
        if (existing.renewableShare === null && props.renewableShare !== undefined && props.renewableShare !== null && props.renewableShare !== '') {
          // New data available, update
        } else {
          if (isNorway) {
            console.log('⚠️ Norway skipped due to duplicate check, existing:', existing.name);
          }
          return;
        }
      }
      
      let lat = 0, lon = 0;
      
      if (feature.geometry) {
        if (feature.geometry.type === "Point") {
          [lon, lat] = feature.geometry.coordinates;
        } else {
          let minLon = Infinity, minLat = Infinity;
          let maxLon = -Infinity, maxLat = -Infinity;

          const traverseCoords = (coords: any) => {
            if (typeof coords[0] === 'number') {
              const [l, t] = coords;
              if (l < minLon) minLon = l;
              if (l > maxLon) maxLon = l;
              if (t < minLat) minLat = t;
              if (t > maxLat) maxLat = t;
            } else {
              coords.forEach((c: any) => traverseCoords(c));
            }
          };

          traverseCoords(feature.geometry.coordinates);

          if (isFinite(minLon) && isFinite(minLat) && isFinite(maxLon) && isFinite(maxLat)) {
            lon = (minLon + maxLon) / 2;
            lat = (minLat + maxLat) / 2;
            
            if (lon === 0 && lat === 0) {
              const findFirstValidCoord = (coords: any): [number, number] | null => {
                if (Array.isArray(coords) && coords.length >= 2) {
                  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
                    return [coords[0], coords[1]];
                  } else if (Array.isArray(coords[0])) {
                    for (const subCoord of coords) {
                      const result = findFirstValidCoord(subCoord);
                      if (result) return result;
                    }
                  }
                }
                return null;
              };
              
              const firstCoord = findFirstValidCoord(feature.geometry.coordinates);
              if (firstCoord) {
                [lon, lat] = firstCoord;
              }
            }
          } else {
            const findFirstValidCoord = (coords: any): [number, number] | null => {
              if (Array.isArray(coords) && coords.length >= 2) {
                if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
                  return [coords[0], coords[1]];
                } else if (Array.isArray(coords[0])) {
                  for (const subCoord of coords) {
                    const result = findFirstValidCoord(subCoord);
                    if (result) return result;
                  }
                }
              }
              return null;
            };
            
            const firstCoord = findFirstValidCoord(feature.geometry.coordinates);
            if (firstCoord) {
              [lon, lat] = firstCoord;
            }
          }
        }
      }
      
      // Manual fixes for specific countries
      const checkId = (iso3 || iso2 || admin || name || "").toUpperCase();
      
      if (checkId === 'RUS' || checkId === 'RU' || checkId.includes('RUSSIA')) {
        lon = 100.0; lat = 60.0;
      } 
      else if (checkId === 'USA' || checkId === 'US' || checkId.includes('UNITED STATES')) {
        lon = -97.0; lat = 38.0;
      }
      else if (checkId === 'FRA' || checkId === 'FR' || checkId === 'FRANCE' || 
               (iso3 === 'FRA') || (iso2 === 'FR') || 
               (admin && admin.toUpperCase().includes('FRANCE')) ||
               (name && name.toUpperCase().includes('FRANCE'))) {
        lon = 2.5; lat = 46.5;
      }
      
      let renewableShare: number | null = null;
      if (props.renewableShare !== undefined && props.renewableShare !== null && props.renewableShare !== '') {
        if (typeof props.renewableShare === 'number') {
          renewableShare = props.renewableShare;
        } else {
          const parsed = parseFloat(String(props.renewableShare));
          renewableShare = isNaN(parsed) ? null : parsed;
        }
      }
      
      const fossilShare = typeof props.fossilShare === 'number'
        ? props.fossilShare
        : (props.fossilShare !== undefined && props.fossilShare !== null && props.fossilShare !== '')
          ? parseFloat(String(props.fossilShare)) || (renewableShare !== null ? 100 - renewableShare : 0)
          : (renewableShare !== null ? 100 - renewableShare : 0);
      
      let co2_per_capita: number | null = null;
      if (props.co2_per_capita !== undefined && props.co2_per_capita !== null && props.co2_per_capita !== '') {
        if (typeof props.co2_per_capita === 'number') {
          co2_per_capita = props.co2_per_capita;
        } else {
          const parsed = parseFloat(String(props.co2_per_capita));
          co2_per_capita = isNaN(parsed) ? null : parsed;
        }
      }
      
      let population: number | null = null;
      if (props.population !== undefined && props.population !== null && props.population !== '') {
        if (typeof props.population === 'number') {
          population = props.population;
        } else {
          const parsed = parseFloat(String(props.population));
          population = isNaN(parsed) ? null : parsed;
        }
      }
      
      let gdp: number | null = null;
      let gdp_per_capita: number = 0;
      
      if (props.gdp !== undefined && props.gdp !== null && props.gdp !== '') {
        if (typeof props.gdp === 'number') {
          gdp = props.gdp;
        } else {
          const parsed = parseFloat(String(props.gdp));
          gdp = isNaN(parsed) ? null : parsed;
        }
      }
      
      if (props.gdp_per_capita !== undefined && props.gdp_per_capita !== null && props.gdp_per_capita !== '') {
        if (typeof props.gdp_per_capita === 'number') {
          gdp_per_capita = props.gdp_per_capita;
        } else {
          const parsed = parseFloat(String(props.gdp_per_capita));
          gdp_per_capita = isNaN(parsed) ? 0 : parsed;
        }
      }
      
      if (gdp_per_capita === 0 && gdp !== null && population !== null && population > 0) {
        gdp_per_capita = gdp / population;
      }
      
      // Get region from props, or recalculate if missing
      let region = props.region || null;
      if (!region) {
        // If region is missing, try to calculate it from available data
        region = getRegionByCode(iso3, iso2, admin || name);
      }
      
      // Create unique ID - avoid using invalid ISO codes like -99
      const uniqueId = (iso3 && iso3 !== '-99' && iso3 !== '-1') ? iso3.toUpperCase() :
                       (iso2 && iso2 !== '-99' && iso2 !== '-1') ? iso2.toUpperCase() :
                       (admin ? admin.toLowerCase().replace(/\s+/g, '-') : null) ||
                       name.toLowerCase().replace(/\s+/g, '-');
      
      const countryPoint: CountryPoint = {
        id: uniqueId,
        name: name,
        code: iso2 || iso3 || "",
        lat: lat,
        lon: lon,
        renewableShare: renewableShare,
        fossilShare: fossilShare,
        co2_per_capita: co2_per_capita,
        population: population,
        gdp: gdp, 
        gdp_per_capita: gdp_per_capita,
        region: region as Region | null,
        greenSize: (renewableShare !== null ? renewableShare : 0) * 0.4, 
        redSize: fossilShare * 0.4
      };
      
      countryMap[countryKey] = countryPoint;
      
      if (isNorway) {
        console.log('✅ Norway added to countryMap with key:', countryKey, 'countryPoint:', {
          name: countryPoint.name,
          code: countryPoint.code,
          renewableShare: countryPoint.renewableShare,
          population: countryPoint.population,
          lat: countryPoint.lat,
          lon: countryPoint.lon,
          region: countryPoint.region,
          id: countryPoint.id,
          'getRegionByCode result': getRegionByCode(iso3, iso2, admin || name)
        });
      }
    });
    
    const countries: CountryPoint[] = Object.values(countryMap)
      .filter((c: CountryPoint) => {
        if (searchTerm && !c.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        
        if (mode === "renewable") {
          if (c.renewableShare === null) return false;
          if (c.renewableShare < minRenewable) return false;
          if (c.renewableShare > maxRenewable) return false;
        } else {
          if (c.co2_per_capita === null) return false;
          if (c.co2_per_capita < minRenewable) return false;
          if (c.co2_per_capita > maxRenewable) return false;
        }
        
        // Region filter for list (table) - show only countries that match the selected region
        if (regionFilter !== "all") {
          // Only show countries that have a region AND match the selected region
          if (!c.region || c.region !== regionFilter) {
            return false;
          }
        }
          
        return true;
      });
    
    // Debug: Check Norway in filteredCountries
    const norwayInFiltered = countries.find((c: CountryPoint) => 
      c.code === 'NOR' || c.name.toLowerCase().includes('norway')
    );
    
    // Check Norway in countryMap before filtering
    const norwayInMap = Object.values(countryMap).find((c: any) => 
      c.code === 'NOR' || c.name.toLowerCase().includes('norway')
    );
    
    if (norwayInFiltered) {
      console.log('✅ Norway found in filteredCountries:', {
        name: norwayInFiltered.name,
        renewableShare: norwayInFiltered.renewableShare,
        population: norwayInFiltered.population,
        region: norwayInFiltered.region
      });
    } else {
      console.log('❌ Norway NOT found in filteredCountries. Total countries:', countries.length);
      console.log('Filter settings:', { mode, minRenewable, maxRenewable, regionFilter, searchTerm });
      if (norwayInMap) {
        console.log('🔍 Norway data BEFORE filtering:', {
          name: norwayInMap.name,
          renewableShare: norwayInMap.renewableShare,
          population: norwayInMap.population,
          region: norwayInMap.region,
          co2_per_capita: norwayInMap.co2_per_capita,
          'renewableShare check': norwayInMap.renewableShare === null ? 'NULL' : 
            (norwayInMap.renewableShare < minRenewable ? `TOO LOW (${norwayInMap.renewableShare} < ${minRenewable})` :
             norwayInMap.renewableShare > maxRenewable ? `TOO HIGH (${norwayInMap.renewableShare} > ${maxRenewable})` : 'OK'),
          'region check': regionFilter !== "all" && norwayInMap.region !== regionFilter ? `WRONG REGION (${norwayInMap.region} !== ${regionFilter})` : 'OK'
        });
      } else {
        console.log('❌ Norway NOT found in countryMap either!');
      }
    }
    
    return countries;
  }, [mergedGeoJson, minRenewable, maxRenewable, regionFilter, searchTerm, mode]);

  const selectedCountries = useMemo(
    () => filteredCountries.filter((c) => selectedIds.includes(c.id)),
    [filteredCountries, selectedIds]
  );

  const tableCountries = selectedCountries.length
    ? selectedCountries
    : filteredCountries;

  // --- COUNTRIES FOR MAP CIRCLES (without searchTerm filter) ---
  const countriesForMap = useMemo(() => {
    if (!mergedGeoJson || !mergedGeoJson.features) {
      return [];
    }
    
    const countryMap: Record<string, CountryPoint> = {};
    
    mergedGeoJson.features.forEach((feature: any) => {
      const props = feature.properties || {};
      const iso3 = props.iso_a3 || props.ISO_A3;
      const iso2 = props.iso_a2 || props.ISO_A2;
      const admin = props.admin || props.ADMIN || props.Entity;
      const name = admin || props.name || props.NAME || "Unknown";
      
      const countryKey = (iso3 && iso3 !== '-99' && iso3 !== '-1') ? iso3.toUpperCase() :
                         (iso2 && iso2 !== '-99' && iso2 !== '-1') ? iso2.toUpperCase() :
                         name.toUpperCase();
      
      if (countryMap[countryKey]) {
        const existing = countryMap[countryKey];
        if (existing.renewableShare === null && props.renewableShare !== undefined && props.renewableShare !== null && props.renewableShare !== '') {
          // New data available, update
        } else {
          return;
        }
      }
      
      let lat = 0, lon = 0;
      
      if (feature.geometry) {
        if (feature.geometry.type === "Point") {
          [lon, lat] = feature.geometry.coordinates;
        } else {
          let minLon = Infinity, minLat = Infinity;
          let maxLon = -Infinity, maxLat = -Infinity;

          const traverseCoords = (coords: any) => {
            if (typeof coords[0] === 'number') {
              const [l, t] = coords;
              if (l < minLon) minLon = l;
              if (l > maxLon) maxLon = l;
              if (t < minLat) minLat = t;
              if (t > maxLat) maxLat = t;
            } else {
              coords.forEach((c: any) => traverseCoords(c));
            }
          };

          traverseCoords(feature.geometry.coordinates);

          if (isFinite(minLon) && isFinite(minLat) && isFinite(maxLon) && isFinite(maxLat)) {
            lon = (minLon + maxLon) / 2;
            lat = (minLat + maxLat) / 2;
            
            if (lon === 0 && lat === 0) {
              const findFirstValidCoord = (coords: any): [number, number] | null => {
                if (Array.isArray(coords) && coords.length >= 2) {
                  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
                    return [coords[0], coords[1]];
                  } else if (Array.isArray(coords[0])) {
                    for (const subCoord of coords) {
                      const result = findFirstValidCoord(subCoord);
                      if (result) return result;
                    }
                  }
                }
                return null;
              };
              
              const firstCoord = findFirstValidCoord(feature.geometry.coordinates);
              if (firstCoord) {
                [lon, lat] = firstCoord;
              }
            }
          } else {
            const findFirstValidCoord = (coords: any): [number, number] | null => {
              if (Array.isArray(coords) && coords.length >= 2) {
                if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
                  return [coords[0], coords[1]];
                } else if (Array.isArray(coords[0])) {
                  for (const subCoord of coords) {
                    const result = findFirstValidCoord(subCoord);
                    if (result) return result;
                  }
                }
              }
              return null;
            };
            
            const firstCoord = findFirstValidCoord(feature.geometry.coordinates);
            if (firstCoord) {
              [lon, lat] = firstCoord;
            }
          }
        }
      }
      
      // Manual fixes for specific countries
      const checkId = (iso3 || iso2 || admin || name || "").toUpperCase();
      
      if (checkId === 'RUS' || checkId === 'RU' || checkId.includes('RUSSIA')) {
        lon = 100.0; lat = 60.0;
      } 
      else if (checkId === 'USA' || checkId === 'US' || checkId.includes('UNITED STATES')) {
        lon = -97.0; lat = 38.0;
      }
      else if (checkId === 'FRA' || checkId === 'FR' || checkId === 'FRANCE' || 
               (iso3 === 'FRA') || (iso2 === 'FR') || 
               (admin && admin.toUpperCase().includes('FRANCE')) ||
               (name && name.toUpperCase().includes('FRANCE'))) {
        lon = 2.5; lat = 46.5;
      }
      
      let renewableShare: number | null = null;
      if (props.renewableShare !== undefined && props.renewableShare !== null && props.renewableShare !== '') {
        if (typeof props.renewableShare === 'number') {
          renewableShare = props.renewableShare;
        } else {
          const parsed = parseFloat(String(props.renewableShare));
          renewableShare = isNaN(parsed) ? null : parsed;
        }
      }
      
      const fossilShare = typeof props.fossilShare === 'number'
        ? props.fossilShare
        : (props.fossilShare !== undefined && props.fossilShare !== null && props.fossilShare !== '')
          ? parseFloat(String(props.fossilShare)) || (renewableShare !== null ? 100 - renewableShare : 0)
          : (renewableShare !== null ? 100 - renewableShare : 0);
      
      let co2_per_capita: number | null = null;
      if (props.co2_per_capita !== undefined && props.co2_per_capita !== null && props.co2_per_capita !== '') {
        if (typeof props.co2_per_capita === 'number') {
          co2_per_capita = props.co2_per_capita;
        } else {
          const parsed = parseFloat(String(props.co2_per_capita));
          co2_per_capita = isNaN(parsed) ? null : parsed;
        }
      }
      
      let population: number | null = null;
      if (props.population !== undefined && props.population !== null && props.population !== '') {
        if (typeof props.population === 'number') {
          population = props.population;
        } else {
          const parsed = parseFloat(String(props.population));
          population = isNaN(parsed) ? null : parsed;
        }
      }
      
      let gdp: number | null = null;
      let gdp_per_capita: number = 0;
      
      if (props.gdp !== undefined && props.gdp !== null && props.gdp !== '') {
        if (typeof props.gdp === 'number') {
          gdp = props.gdp;
        } else {
          const parsed = parseFloat(String(props.gdp));
          gdp = isNaN(parsed) ? null : parsed;
        }
      }
      
      if (props.gdp_per_capita !== undefined && props.gdp_per_capita !== null && props.gdp_per_capita !== '') {
        if (typeof props.gdp_per_capita === 'number') {
          gdp_per_capita = props.gdp_per_capita;
        } else {
          const parsed = parseFloat(String(props.gdp_per_capita));
          gdp_per_capita = isNaN(parsed) ? 0 : parsed;
        }
      }
      
      if (gdp_per_capita === 0 && gdp !== null && population !== null && population > 0) {
        gdp_per_capita = gdp / population;
      }
      
      // Get region from props, or recalculate if missing
      let region = props.region || null;
      if (!region) {
        // If region is missing, try to calculate it from available data
        region = getRegionByCode(iso3, iso2, admin || name);
      }
      
      // Create unique ID - avoid using invalid ISO codes like -99
      const uniqueId = (iso3 && iso3 !== '-99' && iso3 !== '-1') ? iso3.toUpperCase() :
                       (iso2 && iso2 !== '-99' && iso2 !== '-1') ? iso2.toUpperCase() :
                       (admin ? admin.toLowerCase().replace(/\s+/g, '-') : null) ||
                       name.toLowerCase().replace(/\s+/g, '-');
      
      const countryPoint: CountryPoint = {
        id: uniqueId,
        name: name,
        code: iso2 || iso3 || "",
        lat: lat,
        lon: lon,
        renewableShare: renewableShare,
        fossilShare: fossilShare,
        co2_per_capita: co2_per_capita,
        population: population,
        gdp: gdp, 
        gdp_per_capita: gdp_per_capita,
        region: region as Region | null,
        greenSize: (renewableShare !== null ? renewableShare : 0) * 0.4, 
        redSize: fossilShare * 0.4
      };
      
      countryMap[countryKey] = countryPoint;
    });
    
    // Filter countries (WITHOUT searchTerm filter, but with other filters)
    const countries: CountryPoint[] = Object.values(countryMap)
      .filter((c: CountryPoint) => {
        // NOTE: searchTerm filter is intentionally omitted here
        // so that all circles remain visible when a country is searched
        
        if (mode === "renewable") {
          if (c.renewableShare === null) return false;
          if (c.renewableShare < minRenewable) return false;
          if (c.renewableShare > maxRenewable) return false;
        } else {
          if (c.co2_per_capita === null) return false;
          if (c.co2_per_capita < minRenewable) return false;
          if (c.co2_per_capita > maxRenewable) return false;
        }
        
        // Region filter removed - all countries should be visible, only zoom changes
        // if (regionFilter !== "all" && c.region !== regionFilter) return false;
          
        return true;
      });
    
    return countries;
  }, [mergedGeoJson, minRenewable, maxRenewable, regionFilter, mode]);

  // --- GEOJSON CONVERSION ---
  const geoJsonCountries = useMemo(() => {
    const features = countriesForMap.map((c) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [c.lon, c.lat] as [number, number]
      },
      properties: {
        id: c.id,
        name: c.name,
        code: c.code,
        renewableShare: c.renewableShare,
        fossilShare: c.fossilShare,
        co2_per_capita: c.co2_per_capita,
        population: c.population,
        gdp_per_capita: c.gdp_per_capita || 0,
        gdp: c.gdp || 0,
        region: c.region,
        greenSize: c.greenSize,
        redSize: c.redSize,
        isSelected: selectedIds.includes(c.id)
      }
    }));
    
    return {
      type: "FeatureCollection" as const,
      features
    };
  }, [countriesForMap, selectedIds]);

  const hoveredFeatureGeoJson = useMemo(() => {
    if (!hoveredFeatureId || !mergedGeoJson) return null;
    
    const hoveredFeature = mergedGeoJson.features.find((f: any) => {
      const props = f.properties || {};
      const featureId = f.id 
        || props.ISO_A3 || props.iso_a3 
        || props.ADMIN || props.admin 
        || props.NAME || props.name
        || null;
      return featureId && hoveredFeatureId && 
        String(featureId).toLowerCase() === String(hoveredFeatureId).toLowerCase();
    });

    if (!hoveredFeature) {
      return null;
    }

    return {
      type: "FeatureCollection" as const,
      features: [hoveredFeature]
    };
  }, [hoveredFeatureId, mergedGeoJson]);

  const searchableCountries = useMemo(() => {
    if (!mergedGeoJson) return [];
    return mergedGeoJson.features
      .map((f: any) => {
        const props = f.properties || {};
        return props.ADMIN || props.admin || props.NAME || props.name || props.Entity || "";
      })
      .filter((name: string) => name && name.length > 0)
      .sort();
  }, [mergedGeoJson]);

  const filteredSearchCountries = useMemo(() => {
    if (!searchTerm) return [];
    return searchableCountries.filter((name: string) =>
      name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10); 
  }, [searchTerm, searchableCountries]);

  // --- AI LOGIC ---
  useEffect(() => {
    if(chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  const resetChat = () => {
      setChatMessages([
        { role: "assistant", content: "Hello! I analyze the energy transition & CO2 data you see on the screen. How can I help?" }
      ]);
      setUserMessage("");
      setIsChatLoading(false);
  }

  const handleSendMessage = async () => {
    if (!userMessage.trim()) return;
    
    // API key check removed; request goes to backend proxy

    const newMessage: ChatMessage = { role: "user", content: userMessage };
    setChatMessages(prev => [...prev, newMessage]);
    setUserMessage("");
    setIsChatLoading(true);

    // Context preparation for Energy Data
    const topCountries = tableCountries.slice(0, 5).map(c => 
        `${c.name} (Renewable: ${c.renewableShare?.toFixed(1)}%, CO2: ${c.co2_per_capita?.toFixed(2)}t, GDP/cap: $${c.gdp_per_capita?.toLocaleString()})`
    ).join(", ");
    
    const systemContext = `
    You are a specialized AI assistant for a data visualization dashboard focused on Energy Transition and Climate Change.
    
    Your knowledge:
    - Renewable Energy Share data
    - CO2 Emissions per Capita
    - Economic correlation (GDP per capita vs Energy/Emissions)
    - Insights derived from the current dashboard state
    - Related stuff

    You must NOT:
    - Don't ask about "providing pdf" or "give me pdf" or something. User interaction face not capable to do that.

    Current Dashboard State:
    - Year: ${selectedYear}
    - View Mode: ${mode === 'renewable' ? 'Renewable Energy Share' : 'CO2 Emissions Per Capita'}
    - Selected Region: ${regionFilter === 'all' ? 'World' : regionFilter}
    - Top Visible Countries (Sample): ${topCountries}
    `;

    try {
        // Request routed through backend proxy
        const response = await fetch(`${BACKEND}/api/openai/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: newMessage.content,
                systemContext: systemContext,
                // Extra context params (for backend logging/tuning)
                year: selectedYear,
                mode: mode,
                region: regionFilter
            })
        });

        const data = await response.json();
        
        // Expects backend response in { answer: "..." } format
        if(data.answer) {
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


  // --- MAP CLICK HANDLER (Updated for choropleth) ---
  useEffect(() => {
    if (!mapRef.current || !mergedGeoJson) {
      return;
    }

    const map = mapRef.current.getMap();

    const setupEventListeners = () => {
      if (!map.getLayer('choropleth')) {
        setTimeout(setupEventListeners, 100);
        return null;
      }

      const handleClick = (e: any) => {
        if (!e.features || e.features.length === 0) return;
        
        const feature = e.features[0];
        const geometry = feature.geometry;
        
        if (!geometry || !mapRef.current) return;
        
        const calculateBbox = (geom: any): [[number, number], [number, number]] => {
          let minLon = Infinity, minLat = Infinity;
          let maxLon = -Infinity, maxLat = -Infinity;
          
          const processCoordinates = (coords: any[]) => {
            if (Array.isArray(coords[0])) {
              coords.forEach(coord => processCoordinates(coord));
            } else {
              const [lon, lat] = coords;
              minLon = Math.min(minLon, lon);
              maxLon = Math.max(maxLon, lon);
              minLat = Math.min(minLat, lat);
              maxLat = Math.max(maxLat, lat);
            }
          };
          
          if (geom.type === "Polygon") {
            processCoordinates(geom.coordinates);
          } else if (geom.type === "MultiPolygon") {
            geom.coordinates.forEach((polygon: any) => {
              processCoordinates(polygon);
            });
          }
          
          return [[minLon, minLat], [maxLon, maxLat]];
        };
        
        const bbox = calculateBbox(geometry);
        
        if (!isFinite(bbox[0][0]) || !isFinite(bbox[0][1]) || !isFinite(bbox[1][0]) || !isFinite(bbox[1][1])) {
          return;
        }
        
        const center: [number, number] = [
          (bbox[0][0] + bbox[1][0]) / 2,
          (bbox[0][1] + bbox[1][1]) / 2
        ];
        
        const bboxWidth = bbox[1][0] - bbox[0][0];
        const bboxHeight = bbox[1][1] - bbox[0][1];
        const latRad = (center[1] * Math.PI) / 180;
        const latAdjustment = Math.cos(latRad);
        const zoomX = Math.log2(360 / (bboxWidth * latAdjustment));
        const zoomY = Math.log2(180 / bboxHeight);
        let calculatedZoom = Math.min(zoomX, zoomY) - 0.5;
        calculatedZoom = Math.max(2.5, Math.min(6, calculatedZoom));
        
        const map = mapRef.current.getMap();
        
        map.stop();
        
        setTimeout(() => {
          try {
            map.flyTo({
              center: center,
              zoom: calculatedZoom,
              duration: 2000,
              speed: 0.8,
              curve: 1.3,
              essential: true
            });
          } catch (error) {
            // Silent error handling
          }
        }, 50);
      };

      const handleMouseMove = (e: any) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['choropleth']
        });

        if (features && features.length > 0) {
          const feature = features[0];
          const props = feature.properties;
          if (props) {
            
            setHoveredInfo(props);
            setHoveredPos({ x: e.point.x, y: e.point.y });
            const featureId = feature.id 
              || props.ISO_A3 || props.iso_a3 
              || props.ADMIN || props.admin 
              || props.NAME || props.name 
              || null;
            setHoveredFeatureId(featureId);
            map.getCanvas().style.cursor = 'pointer';
          }
        } else {
          setHoveredInfo(null);
          setHoveredFeatureId(null);
          map.getCanvas().style.cursor = '';
        }
      };

      const handleMouseLeave = () => {
        setHoveredInfo(null);
        setHoveredFeatureId(null);
        map.getCanvas().style.cursor = '';
      };

      map.on('click', 'choropleth', handleClick);
      map.on('mousemove', handleMouseMove);
      map.on('mouseleave', 'choropleth', handleMouseLeave);

      return () => {
        map.off('click', 'choropleth', handleClick);
        map.off('mousemove', handleMouseMove);
        map.off('mouseleave', 'choropleth', handleMouseLeave);
      };
    };

    let cleanup: (() => void) | null = null;
    let dataListener: (() => void) | null = null;

    const setupListenersWhenReady = () => {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }

      if (map.getLayer('choropleth')) {
        const source = map.getSource('world');
        
        if (source) {
          const onDataUpdate = (e: any) => {
            if (e.sourceId === 'world' || (!e.sourceId && source)) {
              setTimeout(() => {
                if (cleanup) cleanup();
                cleanup = setupEventListeners();
              }, 200);
            }
          };
          
          setTimeout(() => {
            cleanup = setupEventListeners();
          }, 500);
          
          map.on('data', onDataUpdate);
          dataListener = () => {
            map.off('data', onDataUpdate);
          };
        } else {
          setTimeout(() => {
            cleanup = setupEventListeners();
          }, 500);
        }
      } else if (map.loaded()) {
        const checkLayer = setInterval(() => {
          if (map.getLayer('choropleth')) {
            clearInterval(checkLayer);
            setTimeout(() => {
              cleanup = setupEventListeners();
            }, 300);
          }
        }, 50);
        
        setTimeout(() => {
          clearInterval(checkLayer);
        }, 2000);
      } else {
        map.once('load', () => {
          setTimeout(() => {
            cleanup = setupEventListeners();
          }, 300);
        });
      }
    };

    setupListenersWhenReady();

    return () => {
      if (cleanup) cleanup();
      if (dataListener) dataListener();
    };
  }, [mergedGeoJson]); 

  useEffect(() => {
    if (!mapRef.current || !mergedGeoJson) return;
    
    const map = mapRef.current.getMap();
    if (!map.loaded()) return;
    
    const source = map.getSource('world');
    if (source && source.type === 'geojson') {
      try {
        (source as any).setData(mergedGeoJson);
      } catch (error) {
        // Silent error handling
      }
    }
  }, [mergedGeoJson]);

  useEffect(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current.getMap();
    
    const updateBrightness = () => {
      if (!map.getLayer("choropleth")) {
        setTimeout(updateBrightness, 100);
        return;
      }
      
      try {
        if (regionFilter === "all") {
          map.setPaintProperty("choropleth", "fill-opacity", 0.8);
          return;
        }
        
        map.setPaintProperty("choropleth", "fill-opacity", [
          "case",
          ["==", ["get", "region"], regionFilter],
          1.0,    
          0.8     
        ]);
      } catch (error) {
        // Silent error handling
      }
    };
    
    if (map.getLayer("choropleth")) {
      updateBrightness();
    } else if (map.loaded()) {
      const checkLayer = setInterval(() => {
        if (map.getLayer("choropleth")) {
          clearInterval(checkLayer);
          updateBrightness();
        }
      }, 100);
      setTimeout(() => clearInterval(checkLayer), 5000);
    } else {
      map.once('load', () => {
        const checkLayer = setInterval(() => {
          if (map.getLayer("choropleth")) {
            clearInterval(checkLayer);
            updateBrightness();
          }
        }, 100);
        setTimeout(() => clearInterval(checkLayer), 5000);
      });
    }
  }, [regionFilter, mergedGeoJson]);

  useEffect(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current.getMap();
    
    const handleResize = () => {
      if (map && map.loaded()) {
        try {
          map.resize();
        } catch (error) {
          // Silent error handling
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    if (map.loaded()) {
      setTimeout(() => {
        map.resize();
      }, 100);
    } else {
      map.once('load', () => {
        setTimeout(() => {
          map.resize();
        }, 100);
      });
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [mergedGeoJson]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }
    
    const map = mapRef.current.getMap();
    
    function moveCameraToRegion() {
      try {
        if (regionFilter === "all") {
          map.easeTo({
            center: [0, 20],
            zoom: 1.5,
            duration: 1500,
            easing: (t: number) => t * (2 - t) 
          });
          return;
        }
        
        const target = regionCenters[regionFilter];
        
        if (!target) {
          return;
        }
        
        map.easeTo({
          center: [target.lng, target.lat],
          zoom: target.zoom,
          duration: 2000,
          easing: (t: number) => t * (2 - t), 
          essential: true
        });
      } catch (error) {
        // Silent error handling
      }
    }
    
    if (map.loaded()) {
      setTimeout(() => {
        moveCameraToRegion();
      }, 200);
      return;
    }
    
    let attempts = 0;
    const maxAttempts = 20; 
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      if (map.loaded()) {
        clearInterval(checkInterval);
        setTimeout(() => {
          moveCameraToRegion();
        }, 200);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        setTimeout(() => {
          moveCameraToRegion();
        }, 200);
      }
    }, 100);
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [regionFilter]);

  // --- ACTIONS ---

  const handleClearAll = () => {
    setSelectedIds([]);
    setSearchTerm("");
    if (mode === "renewable") {
      setMinRenewable(0);
      setMaxRenewable(100);
    } else {
      setMinRenewable(0);
      setMaxRenewable(50); // CO2 per capita max
    }
    setRegionFilter("all");
    setIsPlaying(false);
    mapRef.current?.flyTo({
        center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
        zoom: INITIAL_VIEW_STATE.zoom,
        duration: 1500
    });
  };

  const handleSearchCountry = (countryName: string) => {
    if (!countryName || !mergedGeoJson || !mapRef.current) {
      return;
    }

    let foundFeature = mergedGeoJson.features.find((f: any) => {
      const props = f.properties || {};
      const name = props.ADMIN || props.admin || props.NAME || props.name || props.Entity || "";
      return name.toLowerCase() === countryName.toLowerCase();
    });
    
    if (!foundFeature) {
      foundFeature = mergedGeoJson.features.find((f: any) => {
        const props = f.properties || {};
        const name = props.ADMIN || props.admin || props.NAME || props.name || props.Entity || "";
        return name.toLowerCase().includes(countryName.toLowerCase()) || 
               countryName.toLowerCase().includes(name.toLowerCase());
      });
    }
    
    if (!foundFeature) {
      alert(`Country "${countryName}" not found. Please check the spelling or try a different name.`);
      return;
    }

    const geometry = foundFeature.geometry;
    
    const calculateBbox = (geom: any): [[number, number], [number, number]] => {
      let minLon = Infinity, minLat = Infinity;
      let maxLon = -Infinity, maxLat = -Infinity;
      
      const processCoordinates = (coords: any[]) => {
        if (Array.isArray(coords[0])) {
          coords.forEach(coord => processCoordinates(coord));
        } else {
          const [lon, lat] = coords;
          minLon = Math.min(minLon, lon);
          maxLon = Math.max(maxLon, lon);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        }
      };
      
      if (geom.type === "Polygon") {
        processCoordinates(geom.coordinates);
      } else if (geom.type === "MultiPolygon") {
        geom.coordinates.forEach((polygon: any) => {
          processCoordinates(polygon);
        });
      }
      
      return [[minLon, minLat], [maxLon, maxLat]];
    };
    
    const bbox = calculateBbox(geometry);
    
    const center: [number, number] = [
      (bbox[0][0] + bbox[1][0]) / 2, 
      (bbox[0][1] + bbox[1][1]) / 2  
    ];
    
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      
      if (!isFinite(bbox[0][0]) || !isFinite(bbox[0][1]) || !isFinite(bbox[1][0]) || !isFinite(bbox[1][1])) {
        alert('Invalid country bounds. Please try another country.');
        return;
      }
      
      const bboxWidth = bbox[1][0] - bbox[0][0];
      const bboxHeight = bbox[1][1] - bbox[0][1];
      
      const latRad = (center[1] * Math.PI) / 180;
      const latAdjustment = Math.cos(latRad);
      
      const zoomX = Math.log2(360 / (bboxWidth * latAdjustment));
      const zoomY = Math.log2(180 / bboxHeight);
      let calculatedZoom = Math.min(zoomX, zoomY) - 0.5; 
      
      calculatedZoom = Math.max(2.5, Math.min(6, calculatedZoom));
      
      map.stop();
      
      setTimeout(() => {
        try {
          map.flyTo({
            center: center, 
            zoom: calculatedZoom,
            duration: 2000, 
            speed: 0.8, 
            curve: 1.3, 
            essential: true 
          });
        } catch (error) {
          try {
            map.setCenter(center);
            map.setZoom(calculatedZoom);
          } catch (directError) {
            // Silent error handling
          }
        }
      }, 50); 
    }
    
    const props = foundFeature.properties || {};
    const featureId = foundFeature.id 
      || props.ISO_A3 || props.iso_a3 
      || props.ADMIN || props.admin 
      || props.NAME || props.name
      || null;
    
    if (featureId && mapRef.current) {
      const map = mapRef.current.getMap();
      
      try {
        map.setFeatureState(
          { source: 'world', id: featureId },
          { selected: true }
        );
        
        setHoveredFeatureId(featureId);
        
        setTimeout(() => {
          try {
            map.setFeatureState(
              { source: 'world', id: featureId },
              { selected: false }
            );
            setHoveredFeatureId(null);
          } catch (e) {
            // Silent error handling
          }
        }, 5000);
      } catch (e) {
        setHoveredFeatureId(featureId);
        setTimeout(() => {
          setHoveredFeatureId(null);
        }, 5000);
      }
    }
  };

  const handleCountryClick = (c: CountryPoint) => {
    setSelectedIds((prev) => prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]);
    
    mapRef.current?.flyTo({
        center: [c.lon, c.lat],
        zoom: 4, 
        speed: 1.2, 
        curve: 1.42, 
        duration: 1500 
    });
  };

  // --- EVENTS (Brushing) ---
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.mapboxgl-ctrl')) return;
    if (e.shiftKey && e.button === 0) {
      e.preventDefault(); 
      const rect = e.currentTarget.getBoundingClientRect();
      setIsBrushing(true);
      setBrushStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setBrushEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (isBrushing && brushStart) {
      const rect = e.currentTarget.getBoundingClientRect();
      setBrushEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const handleContainerMouseUp = () => {
    if (isBrushing && brushStart && brushEnd && mapRef.current) {
      const x1 = Math.min(brushStart.x, brushEnd.x);
      const y1 = Math.min(brushStart.y, brushEnd.y);
      const x2 = Math.max(brushStart.x, brushEnd.x);
      const y2 = Math.max(brushStart.y, brushEnd.y);

      if (Math.abs(x2 - x1) > 5 || Math.abs(y2 - y1) > 5) {
        const newSelection = filteredCountries.filter(c => {
          const screenPos = mapRef.current?.project([c.lon, c.lat]);
          if (!screenPos) return false;
          return screenPos.x >= x1 && screenPos.x <= x2 && screenPos.y >= y1 && screenPos.y <= y2;
        }).map(c => c.id);
        setSelectedIds([...new Set(newSelection)]);
      }
    }
    setIsBrushing(false);
    setBrushStart(null);
    setBrushEnd(null);
  };

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
        zIndex: 9999,
        background: "linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 50%, #cbd5e1 100%)", 
        overflow: "hidden", 
        fontFamily: "Inter, system-ui, sans-serif",
        cursor: isBrushing ? "crosshair" : "default", 
        display: "flex",
        margin: 0,
        padding: 0
      }}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleContainerMouseUp}
      onMouseLeave={() => { setIsBrushing(false); setBrushStart(null); setBrushEnd(null); }}
    >
      {/* HEADER */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", zIndex: 10, pointerEvents: "none", padding: "2rem" }}>
        <div style={{ maxWidth: "600px", pointerEvents: "auto" }}>
          {!sideBySide && (<Link to="/" style={{ fontSize: "0.9rem", color: "#047857", textDecoration: "none", fontWeight: "bold" }}>
            ← Back to Landingpage
          </Link> )}
          <h1 style={{ fontSize: "2.2rem", margin: "0.5rem 0", fontWeight: 700, color: "#064e3b" }}>
            Energy Transition Dynamics
          </h1>
        </div>
      </div>
      
      {/* Legend - Detailed */}
      {mergedGeoJson && (
        <div style={{ position: "absolute", bottom: "2rem", left: "3rem", backgroundColor: "white", padding: "1rem", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", pointerEvents: "auto", minWidth: "220px", maxWidth: "280px", zIndex: 100 }}>
            <div style={{ fontWeight: 600, marginBottom: "0.75rem", color: "#064e3b", fontSize: "0.9rem" }}>
              {mode === "renewable" ? "🌱 Renewable Share (%)" : "💨 CO₂ Per Capita (tons)"}
            </div>
            {mode === "renewable" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.8rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: "24px", height: "14px", backgroundColor: "#ff6b6b", borderRadius: "3px", border: "1px solid #ddd" }}></div>
                    <span style={{ fontWeight: 500 }}>0% - 25%</span>
                  </div>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>Low</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: "24px", height: "14px", backgroundColor: "#ffd93d", borderRadius: "3px", border: "1px solid #ddd" }}></div>
                    <span style={{ fontWeight: 500 }}>25% - 50%</span>
                  </div>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>Medium</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: "24px", height: "14px", backgroundColor: "#6bcf7f", borderRadius: "3px", border: "1px solid #ddd" }}></div>
                    <span style={{ fontWeight: 500 }}>50% - 75%</span>
                  </div>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>Good</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: "24px", height: "14px", backgroundColor: "#4ecdc4", borderRadius: "3px", border: "1px solid #ddd" }}></div>
                    <span style={{ fontWeight: 500 }}>75% - 100%</span>
                  </div>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>Excellent</span>
                </div>
                <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid #e5e7eb" }}>
                  <div style={{ height: "16px", borderRadius: "4px", background: "linear-gradient(to right, #ff6b6b 0%, #ffd93d 25%, #6bcf7f 50%, #4ecdc4 75%, #45b7d1 100%)", border: "1px solid #ddd", marginBottom: "0.3rem" }}></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#6b7280" }}>
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.8rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: "24px", height: "14px", backgroundColor: "#b3ffb3", borderRadius: "3px", border: "1px solid #ddd" }}></div>
                    <span style={{ fontWeight: 500 }}>&lt; 2 tons</span>
                  </div>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>Very Low</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: "24px", height: "14px", backgroundColor: "#66ff66", borderRadius: "3px", border: "1px solid #ddd" }}></div>
                    <span style={{ fontWeight: 500 }}>2 - 5 tons</span>
                  </div>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>Low</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: "24px", height: "14px", backgroundColor: "#ffd93d", borderRadius: "3px", border: "1px solid #ddd" }}></div>
                    <span style={{ fontWeight: 500 }}>5 - 10 tons</span>
                  </div>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>Medium</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: "24px", height: "14px", backgroundColor: "#ff6b6b", borderRadius: "3px", border: "1px solid #ddd" }}></div>
                    <span style={{ fontWeight: 500 }}>&gt; 10 tons</span>
                  </div>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>High</span>
                </div>
                <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid #e5e7eb" }}>
                  <div style={{ height: "16px", borderRadius: "4px", background: "linear-gradient(to right, #b3ffb3 0%, #66ff66 33%, #ffd93d 66%, #ff6b6b 100%)", border: "1px solid #ddd", marginBottom: "0.3rem" }}></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#6b7280" }}>
                    <span>0</span>
                    <span>10+ tons</span>
                  </div>
                </div>
              </div>
            )}
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #e5e7eb", fontSize: "0.75rem", color: "#9ca3af", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <div style={{ width: "16px", height: "16px", backgroundColor: "#ccc", borderRadius: "3px", border: "1px solid #999" }}></div>
              <span>Gray = No Data</span>
            </div>
            
            <div style={{ marginTop: "0.8rem", paddingTop: "0.8rem", borderTop: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>
                ⭕ Circle Analysis
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#064e3b", opacity: 0.7 }}></div>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#064e3b", opacity: 0.7 }}></div>
                  <span style={{ color: "#6b7280" }}>Size = Population</span>
                </div>
                
                <div style={{ marginTop: "0.3rem", paddingTop: "0.3rem", borderTop: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#374151", marginBottom: "0.4rem" }}>
                    Border Color (Wealth)
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", border: "2px solid #374151", backgroundColor: "transparent" }}></div>
                    <span style={{ color: "#374151", fontWeight: 500, fontSize: "0.7rem" }}>Gray = No Data</span>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", border: "2px solid #ef4444", backgroundColor: "transparent" }}></div>
                    <span style={{ color: "#6b7280", fontSize: "0.7rem" }}>Red = Poor (&lt;$5k)</span>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", border: "2px solid #60a5fa", backgroundColor: "transparent" }}></div>
                    <span style={{ color: "#6b7280", fontSize: "0.7rem" }}>Light Blue = Developing ($5k-$25k)</span>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", border: "2px solid #2563eb", backgroundColor: "transparent" }}></div>
                    <span style={{ color: "#6b7280", fontSize: "0.7rem" }}>Blue = Middle ($25k-$45k)</span>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", border: "3px solid #fbbf24", backgroundColor: "transparent" }}></div>
                    <span style={{ color: "#6b7280", fontSize: "0.7rem" }}>Gold = Rich ($45k-$80k)</span>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", border: "3px solid #b45309", backgroundColor: "transparent" }}></div>
                    <span style={{ color: "#6b7280", fontSize: "0.7rem" }}>Bronze = Very Rich (&gt;$80k)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* MAP */}
      <div style={{ 
        flex: 1, 
        position: "relative", 
        height: "100%",
        overflow: "hidden" 
      }}>
        <Map
          ref={mapRef}
          initialViewState={INITIAL_VIEW_STATE}
          style={{ width: "100%", height: "100%" }}
          mapStyle="https://demotiles.maplibre.org/style.json"
          projection="globe"
          boxZoom={false} 
          dragPan={!isBrushing}
          dragRotate={!isBrushing}
          cursor={isBrushing ? "crosshair" : "grab"}
          onLoad={(e) => {
            const map = e.target;
            
            const layers = map.getStyle().layers;
            const labelLayer = layers.find((layer: any) => layer.type === 'symbol' && layer.layout?.['text-field']);
            if (labelLayer) {
              setFirstSymbolLayerId(labelLayer.id);
            }
            
            if (mapRef.current) {
              setTimeout(() => {
                try {
                  map.resize();
                } catch (error) {
                  // Silent error handling
                }
              }, 100);
            }
          }}
          onMoveEnd={(e) => {
            if (isExternalMoveRef.current) {
              isExternalMoveRef.current = false;
              return;
            }
            if (window.self === window.top) return;

            const { longitude, latitude, zoom, bearing, pitch } = e.viewState;

            window.parent.postMessage(
              {
                type: "VIEW_STATE",
                payload: { longitude, latitude, zoom, bearing, pitch },
                source: "local"
              },
              "*"
            );
          }}
        >
          {mergedGeoJson && mergedGeoJson.features && mergedGeoJson.features.length > 0 && (
            <Source 
              id="world" 
              type="geojson" 
              data={mergedGeoJson}
                      >
              <Layer
                id="choropleth"
                type="fill"
                beforeId={firstSymbolLayerId}
                paint={{
                  "fill-color": mode === "renewable" 
                    ? [
                        "case",
                        ["==", ["get", "renewableShare"], null],
                        "#ccc",
                        [
                          "step",
                          ["get", "renewableShare"],
                          "#ff6b6b",    // 0-25%: Red
                          25, "#ffd93d", // 25-50%: Yellow
                          50, "#6bcf7f", // 50-75%: Green
                          75, "#4ecdc4", // 75-100%: Turquoise
                          100, "#45b7d1" // 100%+: Blue
                        ]
                      ]
                    : [
                        "case",
                        ["==", ["get", "co2_per_capita"], null],
                        "#ccc",
                        ["==", ["get", "co2_per_capita"], 0],
                        "#ccc",
                        [
                          "step",
                          ["get", "co2_per_capita"],
                          "#b3ffb3",    // < 2 tons: Light green (very low)
                          2, "#66ff66", // 2-5 tons: Medium green (low)
                          5, "#ffd93d", // 5-10 tons: Yellow (medium)
                          10, "#ff6b6b" // > 10 tons: Red (high)
                        ]
                      ],
                  "fill-opacity": 0.8 
                }}
              />
              <Layer
                id="choropleth-outline"
                type="line"
                beforeId={firstSymbolLayerId}
                paint={{
                  "line-color": [
                    "case",
                    ["boolean", ["feature-state", "selected"], false],
                    "#059669", 
                    ["==", ["get", "iso_a3"], hoveredFeatureId || ""],
                    "#10b981", 
                    "#ffffff"  
                  ],
                  "line-width": [
                    "case",
                    ["boolean", ["feature-state", "selected"], false],
                    3, 
                    ["==", ["get", "iso_a3"], hoveredFeatureId || ""],
                    2, 
                    0.5 
                  ],
                  "line-opacity": [
                    "case",
                    ["boolean", ["feature-state", "selected"], false],
                    1, 
                    ["==", ["get", "iso_a3"], hoveredFeatureId || ""],
                    0.9, 
                    0.6 
                  ]
                }}
              />
            </Source>
          )}

          {hoveredFeatureGeoJson && (
            <Source id="hovered-feature" type="geojson" data={hoveredFeatureGeoJson}>
              <Layer
                id="hover-highlight"
                type="line"
                paint={{
                  "line-color": "#ffffff",
                  "line-width": 4,
                  "line-opacity": 1,
                  "line-blur": 0
                }}
              />
            </Source>
          )}

          {geoJsonCountries && (
            <Source id="countries" type="geojson" data={geoJsonCountries}>
              <Layer
                id="country-points"
                type="circle"
                paint={{
                  'circle-radius': [
                    'interpolate', ['linear'], ['get', 'population'],
                    0, 1.5,           
                    5000000, 3,       
                    35000000, 6,      
                    85000000, 10,     
                    330000000, 18,    
                    1400000000, 35    
                  ],

                  'circle-color': 'rgba(6, 78, 59, 0.3)', 

                  'circle-stroke-color': [
                    'case',
                    ['==', ['get', 'gdp_per_capita'], 0], '#374151', 
                    ['<', ['get', 'gdp_per_capita'], 0.1], '#374151', 
                    
                    [
                      'interpolate', ['linear'], ['get', 'gdp_per_capita'],
                      0.1, '#ef4444',     
                      5000, '#60a5fa',    
                      25000, '#2563eb',   
                      45000, '#fbbf24',   
                      80000, '#b45309'    
                    ]
                  ],

                  'circle-stroke-width': [
                    'interpolate', ['linear'], ['get', 'gdp_per_capita'],
                    0, 2,      
                    5000, 3,   
                    25000, 4,  
                    45000, 6,  
                    80000, 10  
                  ],

                  'circle-pitch-alignment': 'map'
                }}
              />
            </Source>
          )}
          
          <NavigationControl position="bottom-left" />
        </Map>

        {isBrushing && brushStart && brushEnd && (
          <div style={{ position: "absolute", left: Math.min(brushStart.x, brushEnd.x), top: Math.min(brushStart.y, brushEnd.y), width: Math.abs(brushEnd.x - brushStart.x), height: Math.abs(brushEnd.y - brushStart.y), border: "1px dashed rgba(5, 150, 105, 0.9)", backgroundColor: "rgba(16,185,129,0.2)", pointerEvents: "none", zIndex: 20 }} />
        )}
      </div>

      {/* TOOLTIP */}
      {hoveredInfo && (
        <div style={{ position: "fixed", zIndex: 99999, pointerEvents: "none", left: hoveredPos.x, top: hoveredPos.y, transform: 'translate(-50%, -110%)', backgroundColor: "white", padding: "0.6rem", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontSize: "0.85rem", border: "1px solid #e5e7eb", minWidth: "180px" }}>
          <div style={{fontWeight:"bold", color:"#064e3b", marginBottom: "0.3rem"}}>
            {hoveredInfo.ADMIN || hoveredInfo.NAME || hoveredInfo.Entity || "Unknown"}
          </div>
          
          {mode === "renewable" && (
            <>
              {hoveredInfo.renewableShare !== undefined && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ color: "#059669" }}>🌱 Renewable:</span>
                  <span style={{ fontWeight: 600 }}>{hoveredInfo.renewableShare.toFixed(1)}%</span>
                </div>
              )}
              {hoveredInfo.co2_per_capita !== undefined && hoveredInfo.co2_per_capita !== null && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", paddingTop: "0.3rem", borderTop: "1px solid #e5e7eb" }}>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>CO₂ Per Capita:</span>
                  <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>
                    {hoveredInfo.co2_per_capita > 0 ? `${hoveredInfo.co2_per_capita.toFixed(2)} tons` : "0 tons"}
                  </span>
                </div>
              )}
              {hoveredInfo.co2_per_capita === null && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", paddingTop: "0.3rem", borderTop: "1px solid #e5e7eb" }}>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>CO₂ Per Capita:</span>
                  <span style={{ fontWeight: 600, fontSize: "0.75rem", color: "#9ca3af" }}>N/A</span>
                </div>
              )}
              {hoveredInfo.population !== undefined && hoveredInfo.population > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", paddingTop: "0.3rem", borderTop: "1px solid #e5e7eb" }}>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>👥 Population:</span>
                  <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>
                    {(hoveredInfo.population / 1000000).toFixed(1)}M
                  </span>
                </div>
              )}
              
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", paddingTop: "0.3rem", borderTop: "1px solid #e5e7eb" }}>
                <span style={{ color: "#d97706", fontSize: "0.75rem" }}>💰 GDP Total:</span>
                <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>
                  {hoveredInfo.gdp > 0 
                    ? `$${(hoveredInfo.gdp / 1000000000).toLocaleString(undefined, {maximumFractionDigits:1})}B` 
                    : "N/A"}
                </span>
              </div>

              {hoveredInfo.gdp > 0 && hoveredInfo.population > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.2rem" }}>
                  <span style={{ color: "#b45309", fontSize: "0.75rem" }}>👤 GDP per Cap:</span>
                  <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>
                    ${Math.round(hoveredInfo.gdp / hoveredInfo.population).toLocaleString()}
                  </span>
                </div>
              )}
            </>
          )}
          
          {mode === "co2_per_capita" && (
            <>
              {hoveredInfo.co2_per_capita !== undefined && hoveredInfo.co2_per_capita !== null && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ color: "#f97316" }}>🔥 CO₂ Per Capita:</span>
                  <span style={{ fontWeight: 600 }}>
                    {hoveredInfo.co2_per_capita > 0 ? `${hoveredInfo.co2_per_capita.toFixed(2)} tons` : "0 tons"}
                  </span>
                </div>
              )}
              {hoveredInfo.co2_per_capita === null && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ color: "#f97316" }}>🔥 CO₂ Per Capita:</span>
                  <span style={{ fontWeight: 600, color: "#9ca3af" }}>N/A</span>
                </div>
              )}
              {hoveredInfo.renewableShare !== undefined && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", paddingTop: "0.3rem", borderTop: "1px solid #e5e7eb" }}>
                  <span style={{ color: "#1f2937", fontSize: "0.75rem" }}>🌱 Renewable:</span>
                  <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>{hoveredInfo.renewableShare.toFixed(1)}%</span>
                </div>
              )}
              {hoveredInfo.population !== undefined && hoveredInfo.population > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", paddingTop: "0.3rem", borderTop: "1px solid #e5e7eb" }}>
                  <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>👥 Population:</span>
                  <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>
                    {(hoveredInfo.population / 1000000).toFixed(1)}M
                  </span>
                </div>
              )}
              
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", paddingTop: "0.3rem", borderTop: "1px solid #e5e7eb" }}>
                <span style={{ color: "#d97706", fontSize: "0.75rem" }}>💰 GDP Total:</span>
                <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>
                  {hoveredInfo.gdp > 0 
                    ? `$${(hoveredInfo.gdp / 1000000000).toLocaleString(undefined, {maximumFractionDigits:1})}B` 
                    : "N/A"}
                </span>
              </div>

              {hoveredInfo.gdp > 0 && hoveredInfo.population > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.2rem" }}>
                  <span style={{ color: "#b45309", fontSize: "0.75rem" }}>👤 GDP per Cap:</span>
                  <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>
                    ${Math.round(hoveredInfo.gdp / hoveredInfo.population).toLocaleString()}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* AI CHAT PANEL */}
      {isChatOpen && (
          <div style={{
              width: "350px",
              height: "100vh",
              backgroundColor: "#f0fdf4", 
              borderRight: "1px solid #bbf7d0",
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
                  borderBottom: "1px solid #bbf7d0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#dcfce7",
                }}
              >
                <span style={{ fontWeight: "bold", color: "#7c2d12" }}>AI Data Assistant 🤖</span>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    onClick={resetChat}
                    style={{
                      border: "1px solid #bbf7d0",
                      background: "white",
                      borderRadius: "10px",
                      padding: "6px 10px",
                      cursor: "pointer",
                      color: "#064e3b",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                    }}
                    title="Clear Chat"
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
                      color: "#064e3b",
                    }}
                    title="Close"
                  >
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
                  {isChatLoading && <div style={{ alignSelf: "flex-start", color: "#9ca3af", fontSize: "0.8rem", fontStyle: "italic" }}>AI analyzing data...</div>}
                  <div ref={chatEndRef} />
              </div>

              <div style={{ padding: "1rem", borderTop: "1px solid #059669", display: "flex", gap: "0.5rem", background: "white" }}>
                  <input 
                      type="text" 
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Ask about trends..." 
                      style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: "6px", padding: "8px", fontSize: "0.9rem", outline: "none", color: "white" }}
                  />
                  <button onClick={handleSendMessage} style={{ background: "#059669", color: "white", border: "none", borderRadius: "6px", padding: "0 14px", cursor: "pointer", fontSize: "1.1rem" }}>➤</button>
              </div>
          </div>
      )}

      {/* SIDEBAR */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "400px", height: "100vh", backgroundColor: "white",
          borderLeft: "1px solid #d1d5db", boxShadow: "-4px 0 15px rgba(0,0,0,0.05)",
          padding: "2rem 1.5rem", display: "flex", flexDirection: "column",
          gap: "1.2rem", fontSize: "0.9rem", zIndex: 50, overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            style={{ 
                background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", 
                border: "none", 
                borderRadius: "20px", 
                padding: "0.5rem 1rem", 
                color: "white", 
                fontWeight: "bold", 
                fontSize: "0.8rem", 
                cursor: "pointer", 
                boxShadow: "0 4px 6px rgba(16, 185, 129, 0.3)",
                transition: "transform 0.1s",
                whiteSpace: "nowrap",
                padding: "8px 18px", // 8px top/bottom, 18px left/right
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.95)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            {isChatOpen ? "Close AI" : "Chat With AI ✨"}
          </button>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#047857" }}>Interactions</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#064e3b" }}>Linking, Brushing & Filtering</div>
          </div>
        </div>

        {availableYears.length > 0 && selectedYear && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontWeight: 500, color: "#374151" }}>
              Year: {selectedYear}
            </label>
            <input 
              id="year-slider"
              type="range" 
              min={availableYears[0]} 
              max={availableYears[availableYears.length - 1]} 
              value={selectedYear} 
              onChange={(e) => {
                const newYear = Number(e.target.value);
                setSelectedYear(newYear);
              }} 
              onMouseUp={() => {
                if (window.self !== window.top) {
                  window.parent.postMessage(
                    {
                      type: "TIME_STATE",
                      payload: { year: selectedYear },
                      source: "local"
                    },
                    "*"
                  );
                }
              }}
              style={{ width: "100%", accentColor: "#059669", cursor: "pointer" }} 
            />
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            onClick={() => setMode("renewable")}
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: "6px",
              border: mode === "renewable" ? "2px solid #059669" : "1px solid #d1d5db",
              backgroundColor: mode === "renewable" ? "#ecfdf5" : "white",
              color: mode === "renewable" ? "#047857" : "#6b7280",
              fontWeight: mode === "renewable" ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Renewable Share
          </button>
          <button
            onClick={() => setMode("co2_per_capita")}
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: "6px",
              border: mode === "co2_per_capita" ? "2px solid #059669" : "1px solid #d1d5db",
              backgroundColor: mode === "co2_per_capita" ? "#ecfdf5" : "white",
              color: mode === "co2_per_capita" ? "#047857" : "#6b7280",
              fontWeight: mode === "co2_per_capita" ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            CO₂ Per Capita
          </button>
        </div>

        <div style={{ position: "relative" }}>
            <input 
                id="country-search"
                type="text" 
                placeholder="Search country..." 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchTerm) {
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    const countryToSearch = filteredSearchCountries.length > 0 
                      ? filteredSearchCountries[0] 
                      : searchTerm.trim();
                    handleSearchCountry(countryToSearch);
                    setSearchTerm(countryToSearch);
                    setShowSearchDropdown(false);
                  } else if (e.key === "Escape") {
                    setShowSearchDropdown(false);
                  }
                }}
                onFocus={() => setShowSearchDropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowSearchDropdown(false), 200);
                }}
                style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "0.9rem",
                    outline: "none",
                    backgroundColor: "#ffffff",
                    color: "#111827" 
                }}
            />
            {showSearchDropdown && filteredSearchCountries.length > 0 && (
              <div style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "0.25rem",
                backgroundColor: "white",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                maxHeight: "200px",
                overflowY: "auto",
                zIndex: 1000,
                color: "#111827" 
              }}>
                {filteredSearchCountries.map((countryName: string, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSearchTerm(countryName);
                      handleSearchCountry(countryName);
                      setShowSearchDropdown(false);
                    }}
                    style={{
                      padding: "0.6rem 0.8rem",
                      cursor: "pointer",
                      borderBottom: idx < filteredSearchCountries.length - 1 ? "1px solid #e5e7eb" : "none",
                      fontSize: "0.9rem",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "white";
                    }}
                  >
                    {countryName}
                  </div>
                ))}
              </div>
            )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ 
            backgroundColor: "#f9fafb", 
            padding: "0.8rem", 
            borderRadius: "8px", 
            border: "1px solid #e5e7eb",
            display: "flex", 
            flexDirection: "column", 
            gap: "0.8rem" 
          }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "-0.2rem" }}>
              {mode === "renewable" ? "Renewable Share Range" : "CO₂ Per Capita Range"}
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: "3px", color: "#059669" }}>
                <span>Min: {minRenewable}{mode === "renewable" ? "%" : " tons"}</span>
              </div>
              <input 
                id="min-renewable-slider"
                type="range" 
                min={0} 
                max={mode === "renewable" ? 100 : 50} 
                value={minRenewable} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val <= maxRenewable) setMinRenewable(val);
                }} 
                style={{ width: "100%", accentColor: "#059669", height: "6px", cursor: "pointer" }} 
              />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: "3px", color: "#ef4444" }}>
                <span style={{ marginLeft: "auto" }}>Max: {maxRenewable}{mode === "renewable" ? "%" : " tons"}</span>
              </div>
              <input 
                id="max-renewable-slider"
                type="range" 
                min={0} 
                max={mode === "renewable" ? 100 : 50} 
                value={maxRenewable} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= minRenewable) setMaxRenewable(val);
                }} 
                style={{ width: "100%", accentColor: "#ef4444", height: "6px", cursor: "pointer" }} 
              />
            </div>
            <div style={{ fontSize: "0.7rem", textAlign: "center", color: "#6b7280", borderTop: "1px solid #e5e7eb", paddingTop: "0.5rem" }}>
              Showing: <b>{minRenewable}{mode === "renewable" ? "%" : " tons"}</b> - <b>{maxRenewable}{mode === "renewable" ? "%" : " tons"}</b>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontWeight: 500, color: "#374151", fontSize: "0.9rem" }}>Region:</span>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value as Region | "all")} style={{ flex: 1, borderRadius: "6px", padding: "0.4rem", border: "1px solid #d1d5db", backgroundColor: "#f9fafb", fontSize: "0.85rem", color: "#111827" }}>
              <option value="all">All</option>
              <option value="europe">Europe</option>
              <option value="asia">Asia</option>
              <option value="americas">Americas</option>
            </select>
          </div>
        </div>

        <button 
            onClick={handleClearAll}
            style={{
                padding: "0.5rem",
                backgroundColor: "white",
                border: "1px solid #ef4444",
                color: "#ef4444",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600,
                transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {e.currentTarget.style.backgroundColor = "#fef2f2"}}
            onMouseLeave={(e) => {e.currentTarget.style.backgroundColor = "white"}}
        >
            Clear All Selection & Filters
        </button>

        <div style={{ height: "1px", backgroundColor: "#e5e7eb", margin: "0.5rem 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 600 }}>
          <span>Filtered Countries</span>
          <span>{tableCountries.length} shown</span>
        </div>

        <div style={{ overflowY: "auto", flex: 1, paddingRight: "5px" }}>
          {tableCountries.map((c) => {
            const active = hoveredInfo?.id === c.id || selectedIds.includes(c.id);
            return (
              <div
                key={c.id}
                onMouseEnter={() => setHoveredInfo(c)}
                onMouseLeave={() => setHoveredInfo(null)}
                onClick={() => handleCountryClick(c)}
                style={{
                  padding: "0.6rem", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem",
                  backgroundColor: active ? "#ecfdf5" : "transparent", cursor: "pointer",
                  borderLeft: active ? "4px solid #059669" : "4px solid transparent", transition: "all 0.1s ease-out"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#111827" }}>{c.name}</span>
                  <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{c.region ? c.region.toUpperCase() : "N/A"}</span>
                </div>
                <div style={{ fontSize: "0.85rem", textAlign: "right", display: "flex", flexDirection: "column" }}>
                  <span style={{ color: "#059669", fontWeight: 500 }}>🌱 {c.renewableShare !== null ? `${c.renewableShare}%` : 'N/A'}</span>
                  <span style={{ color: "#dc2626", fontWeight: 500 }}>
                    🌫️ {c.co2_per_capita !== null && c.co2_per_capita !== undefined 
                      ? `${c.co2_per_capita.toFixed(2)} tons` 
                      : 'N/A'}
                  </span>
                </div>
              </div>
            );
          })}
          {tableCountries.length === 0 && <div style={{ fontSize: "0.9rem", color: "#6b7280", fontStyle: "italic", textAlign: "center", marginTop: "2rem" }}>No countries match your criteria.</div>}
        </div>
      </div>
    </div>
  );
}