import React, { useState } from "react";
import { importResource } from "../../services/api";
import { LoadingSpinner } from "../common/LoadingSpinner";

const EXAMPLE_URLS = [
  "https://ocw.mit.edu/courses/",
  "https://oyc.yale.edu/",
  "https://www.coursera.org/learn/",
  "https://canvas.harvard.edu/courses/",
];

function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export default function CrossInstitutionImport({ fingerprint, baseCoords, onClose, onImported }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleImport = async () => {
    if (!url.trim()) return setError("Please enter a URL.");
    if (!isValidUrl(url.trim())) return setError("Please enter a valid URL (include https://).");
    if (!fingerprint) return setError("No classroom fingerprint found. Please go back to setup.");

    setError("");
    setLoading(true);
    try {
      const res = await importResource(url.trim(), fingerprint, baseCoords);
      const { resource } = res.data;
      setSuccess(true);
      setTimeout(() => {
        onImported(resource);
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to import. Try a different URL.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleImport();
  };

  return (
    <div className="w-[380px] min-w-[340px] h-screen bg-white shadow-2xl border-l border-gray-100 flex flex-col animate-slide-in z-20">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🎓</span>
            <h2 className="text-lg font-bold text-gray-900">Import from Institution</h2>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Paste any university or institution resource URL. TeachMap will score and localise it for your class.
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition flex-shrink-0 ml-3"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* URL Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Institution resource URL
          </label>
          <div className="relative">
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
              onKeyDown={handleKeyDown}
              placeholder="https://harvard.edu/courses/..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50 transition"
              disabled={loading || success}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-lg">
              🔗
            </div>
          </div>
          {error && (
            <p className="mt-2 text-red-500 text-xs font-medium">{error}</p>
          )}
        </div>

        {/* Import button */}
        <button
          onClick={handleImport}
          disabled={loading || success || !url.trim()}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow
            ${success
              ? "bg-green-500 text-white"
              : "bg-gradient-to-r from-purple-500 to-teal-500 text-white hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
        >
          {loading ? (
            <>
              <LoadingSpinner size="sm" color="white" />
              <span>Fetching & scoring…</span>
            </>
          ) : success ? (
            <>
              <span>✓</span>
              <span>Imported! Opening scorecard…</span>
            </>
          ) : (
            <>
              <span>🎓</span>
              <span>Import & Score Resource</span>
            </>
          )}
        </button>

        {/* What happens section */}
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">What happens</p>
          {[
            { icon: "🔍", text: "Perplexity fetches and summarises the resource" },
            { icon: "🧠", text: "Claude scores it against your class fingerprint" },
            { icon: "🗺️", text: "Added to your map with a graduation cap icon" },
            { icon: "🔄", text: "Full Companion Guide available to localise it" },
          ].map(({ icon, text }, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-purple-700">
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Example URLs */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Try an example</p>
          <div className="space-y-1">
            {EXAMPLE_URLS.map((example) => (
              <button
                key={example}
                onClick={() => { setUrl(example); setError(""); }}
                className="w-full text-left text-xs text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg px-2 py-1.5 transition truncate"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2 text-xs text-gray-400">
          <span className="flex-shrink-0 mt-0.5">ℹ️</span>
          <p>
            Only publicly accessible URLs are supported. Paywalled content will return limited results.
            Imported resources are marked with 🎓 on the map.
          </p>
        </div>
      </div>
    </div>
  );
}
