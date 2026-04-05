import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { searchResources } from "../../services/api";
import { ResourceMarkerSkeleton } from "../common/SkeletonLoader";
import { LoadingDots } from "../common/LoadingSpinner";
import Scorecard from "../Scorecard";
import CrossInstitutionImport from "../CrossInstitution";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

const YEAR_LEVELS = [
  "Year 1","Year 2","Year 3","Year 4","Year 5","Year 6",
  "Year 7","Year 8","Year 9","Year 10","Year 11","Year 12","University",
];

function scoreToColor(score) {
  if (score >= 80) return { bg: "bg-green-500", hex: "#22c55e", ring: "ring-green-300" };
  if (score >= 60) return { bg: "bg-teal-500", hex: "#14b8a6", ring: "ring-teal-300" };
  if (score >= 40) return { bg: "bg-yellow-400", hex: "#facc15", ring: "ring-yellow-200" };
  return { bg: "bg-red-400", hex: "#f87171", ring: "ring-red-200" };
}

function scoreToSize(score) {
  if (score >= 80) return 42;
  if (score >= 60) return 34;
  if (score >= 40) return 26;
  return 20;
}

function ResourceMarker({ resource, isSelected, onClick }) {
  const color = scoreToColor(resource.avg_score);
  const size = scoreToSize(resource.avg_score);

  return (
    <Marker
      longitude={resource.longitude}
      latitude={resource.latitude}
      anchor="center"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClick(resource); }}
        className="relative group focus:outline-none"
        title={resource.title}
      >
        <div
          className={`rounded-full border-2 border-white shadow-lg transition-all duration-200 flex items-center justify-center cursor-pointer
            ${isSelected ? `ring-4 ${color.ring} scale-125` : "hover:scale-110"}
            ${resource.is_imported ? "border-dashed border-purple-400" : ""}
          `}
          style={{
            width: size,
            height: size,
            backgroundColor: color.hex,
            opacity: resource.avg_score < 40 ? 0.6 : 1,
          }}
        >
          {resource.is_imported ? (
            <span className="text-white text-xs">🎓</span>
          ) : (
            <span className="text-white font-bold" style={{ fontSize: Math.max(8, size * 0.35) }}>
              {Math.round(resource.avg_score)}
            </span>
          )}
        </div>
        {/* Tooltip on hover */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap max-w-xs truncate shadow-xl">
            {resource.title}
          </div>
        </div>
      </button>
    </Marker>
  );
}

export default function MapView() {
  const navigate = useNavigate();
  const [fingerprint, setFingerprint] = useState(null);
  const [resources, setResources] = useState([]);
  const [filteredResources, setFilteredResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Searching for resources…");
  const [selectedResource, setSelectedResource] = useState(null);
  const [baseCoords, setBaseCoords] = useState({ lat: -33.8688, lng: 151.2093 });
  const [viewport, setViewport] = useState({
    longitude: 151.2093,
    latitude: -33.8688,
    zoom: 10,
  });

  // Filter states
  const [eslFilter, setEslFilter] = useState(0);
  const [yearFilter, setYearFilter] = useState("");
  const [showImported, setShowImported] = useState(true);

  // Panel states
  const [showScorecard, setShowScorecard] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);

  // Load fingerprint from session and fetch resources
  useEffect(() => {
    const stored = sessionStorage.getItem("teachmap_fingerprint");
    if (!stored) { navigate("/"); return; }

    const fp = JSON.parse(stored);
    setFingerprint(fp);

    setLoadingMessage("🔍 Searching for resources with Perplexity…");
    setLoading(true);

    searchResources(fp)
      .then((res) => {
        const { resources: found, base_coords } = res.data;
        setResources(found);
        setFilteredResources(found);
        if (base_coords) {
          setBaseCoords(base_coords);
          setViewport((v) => ({
            ...v,
            longitude: base_coords.lng,
            latitude: base_coords.lat,
          }));
        }
      })
      .catch((err) => console.error("Search error:", err))
      .finally(() => setLoading(false));
  }, [navigate]);

  // Apply filters whenever sliders change
  useEffect(() => {
    let filtered = resources;

    if (eslFilter > 0) {
      filtered = filtered.filter((r) => r.esl_accessibility >= eslFilter);
    }

    if (!showImported) {
      filtered = filtered.filter((r) => !r.is_imported);
    }

    setFilteredResources(filtered);
  }, [resources, eslFilter, showImported, yearFilter]);

  const handleMarkerClick = (resource) => {
    setSelectedResource(resource);
    setShowScorecard(true);
    setShowImportPanel(false);
  };

  const handleCloseScorecard = () => {
    setShowScorecard(false);
    setSelectedResource(null);
  };

  const handleResourceImported = (newResource) => {
    setResources((prev) => [...prev, newResource]);
    setSelectedResource(newResource);
    setShowScorecard(true);
    setShowImportPanel(false);
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-gray-900">
      {/* LEFT SIDEBAR — 30% */}
      <div className="w-[30%] min-w-[280px] max-w-[400px] bg-white flex flex-col h-screen overflow-hidden shadow-xl z-10">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-teal-600 to-green-600 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <span className="text-white font-bold text-lg">TeachMap</span>
            </div>
            <button
              onClick={() => navigate("/")}
              className="text-white/70 hover:text-white text-xs transition"
            >
              New class ↺
            </button>
          </div>
          {fingerprint && (
            <div className="mt-2 text-white/80 text-xs">
              <span className="font-semibold text-white">{fingerprint.year_level}</span>
              {" · "}{fingerprint.topic}
              {" · "}{fingerprint.location}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0 space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</h3>

          {/* ESL Accessibility slider */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">ESL Accessibility</label>
              <span className="text-sm font-semibold text-teal-600">{eslFilter}%+</span>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              step={10}
              value={eslFilter}
              onChange={(e) => setEslFilter(Number(e.target.value))}
              className="w-full h-2 accent-teal-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>All</span>
              <span>ESL-optimised</span>
            </div>
          </div>

          {/* Year Level override */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Year Level Filter</label>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="">All levels</option>
              {YEAR_LEVELS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Show imported toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              className={`w-10 h-5 rounded-full transition-colors duration-200 ${showImported ? "bg-teal-500" : "bg-gray-200"}`}
              onClick={() => setShowImported((v) => !v)}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform duration-200 ${showImported ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </div>
            <span className="text-sm text-gray-700">Show imported resources</span>
          </label>
        </div>

        {/* Resource list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Resources ({filteredResources.length})
            </h3>
            {loading && <LoadingDots />}
          </div>

          {loading ? (
            <div className="space-y-3">
              <ResourceMarkerSkeleton />
              <p className="text-teal-600 text-xs font-medium text-center mt-2">{loadingMessage}</p>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm">No resources match your filters.</p>
              <button
                onClick={() => { setEslFilter(0); setYearFilter(""); }}
                className="mt-2 text-teal-500 text-sm hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredResources.map((r) => {
                const color = scoreToColor(r.avg_score);
                return (
                  <button
                    key={r.id}
                    onClick={() => handleMarkerClick(r)}
                    className={`w-full text-left rounded-xl p-3 border transition-all duration-150 hover:shadow-md ${
                      selectedResource?.id === r.id
                        ? "border-teal-400 bg-teal-50 shadow-md"
                        : "border-gray-100 bg-white hover:border-teal-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold`}
                        style={{ backgroundColor: color.hex }}
                      >
                        {r.is_imported ? "🎓" : Math.round(r.avg_score)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
                          {r.title}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {r.url}
                        </p>
                        {r.is_imported && (
                          <span className="inline-block mt-1 text-[10px] bg-purple-100 text-purple-600 rounded px-1.5 py-0.5 font-medium">
                            Imported · {r.imported_from}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Import from Institution */}
        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={() => { setShowImportPanel((v) => !v); setShowScorecard(false); }}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-teal-300 text-teal-600 text-sm font-semibold hover:bg-teal-50 transition flex items-center justify-center gap-2"
          >
            <span>🎓</span>
            <span>Import from Institution</span>
          </button>
        </div>
      </div>

      {/* MAP — fills remaining width */}
      <div className="flex-1 relative">
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          {...viewport}
          onMove={(evt) => setViewport(evt.viewState)}
          mapStyle="mapbox://styles/mapbox/light-v11"
          style={{ width: "100%", height: "100%" }}
          onClick={() => { setShowScorecard(false); setSelectedResource(null); }}
        >
          <NavigationControl position="top-right" />

          {/* Resource markers */}
          {filteredResources.map((r) => (
            <ResourceMarker
              key={r.id}
              resource={r}
              isSelected={selectedResource?.id === r.id}
              onClick={handleMarkerClick}
            />
          ))}
        </Map>

        {/* Loading overlay on map */}
        {loading && (
          <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none z-20">
            <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
              <div className="w-12 h-12 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-700 font-semibold text-sm">Finding resources…</p>
              <p className="text-gray-400 text-xs mt-1">Scoring with Claude AI</p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-full px-5 py-2 shadow-lg flex items-center gap-4 text-xs text-gray-600 z-10">
          <span className="font-semibold">Score:</span>
          {[
            { label: "80+", color: "#22c55e" },
            { label: "60+", color: "#14b8a6" },
            { label: "40+", color: "#facc15" },
            { label: "<40", color: "#f87171" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span>{label}</span>
            </div>
          ))}
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-dashed border-purple-400 bg-purple-200" />
            <span>Imported</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — Scorecard */}
      {showScorecard && selectedResource && (
        <Scorecard
          resource={selectedResource}
          fingerprint={fingerprint}
          onClose={handleCloseScorecard}
        />
      )}

      {/* RIGHT PANEL — Cross-Institution Import */}
      {showImportPanel && (
        <CrossInstitutionImport
          fingerprint={fingerprint}
          baseCoords={baseCoords}
          onClose={() => setShowImportPanel(false)}
          onImported={handleResourceImported}
        />
      )}
    </div>
  );
}
