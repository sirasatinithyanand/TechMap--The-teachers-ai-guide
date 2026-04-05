import React, { useState, useEffect } from "react";
import { localiseResource } from "../../services/api";
import { LoadingOverlay } from "../common/LoadingSpinner";

function ContextSwapCard({ original, replacement, index }) {
  return (
    <div
      className="flex items-stretch gap-0 rounded-xl overflow-hidden border border-gray-100 shadow-sm animate-fade-in"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Before */}
      <div className="flex-1 bg-red-50 px-4 py-3 border-r border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-red-500 text-xs font-bold">✕</span>
          </div>
          <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wide">Original</span>
        </div>
        <p className="text-sm text-red-700 font-medium leading-snug">{original}</p>
      </div>
      {/* Arrow */}
      <div className="flex items-center px-2 bg-white z-10">
        <span className="text-gray-300 font-bold">→</span>
      </div>
      {/* After */}
      <div className="flex-1 bg-green-50 px-4 py-3 border-l border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-500 text-xs font-bold">✓</span>
          </div>
          <span className="text-[10px] text-green-500 font-semibold uppercase tracking-wide">Localised</span>
        </div>
        <p className="text-sm text-green-700 font-medium leading-snug">{replacement}</p>
      </div>
    </div>
  );
}

export default function CompanionGuide({ resource, fingerprint, onClose, onMarkUsed }) {
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    localiseResource(fingerprint, resource)
      .then((res) => setGuide(res.data.guide))
      .catch((err) => setError(err.response?.data?.error || "Failed to generate guide"))
      .finally(() => setLoading(false));
  }, [resource, fingerprint]);

  return (
    <div className="w-[420px] min-w-[360px] h-screen bg-white shadow-2xl border-l border-gray-100 flex flex-col animate-slide-in z-20 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-green-50 flex items-center justify-between flex-shrink-0">
        <div>
          <button
            onClick={onClose}
            className="text-teal-500 hover:text-teal-700 text-xs font-semibold mb-1 transition flex items-center gap-1"
          >
            ← Back to Scorecard
          </button>
          <h2 className="text-lg font-bold text-gray-900">Companion Guide</h2>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{resource.title}</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition flex-shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 relative">
        {loading && <LoadingOverlay message="Claude is localising this resource for your class…" />}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-sm">
            <p className="font-semibold mb-1">Failed to generate guide</p>
            <p>{error}</p>
          </div>
        )}

        {guide && !loading && (
          <div className="space-y-6 animate-fade-in">
            {/* Time saved banner */}
            {guide.prep_time_saved_minutes > 0 && (
              <div className="flex items-center gap-3 bg-teal-600 text-white rounded-xl px-4 py-3 shadow-md">
                <span className="text-xl">⏱</span>
                <div>
                  <p className="font-bold text-sm">Estimated time saved</p>
                  <p className="text-teal-100 text-xs">{guide.prep_time_saved_minutes} minutes of prep</p>
                </div>
                <div className="ml-auto text-2xl font-black">{guide.prep_time_saved_minutes}m</div>
              </div>
            )}

            {/* Context Swaps */}
            {guide.context_swaps && guide.context_swaps.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span>🔄</span> Context Swaps
                </h3>
                <div className="space-y-2">
                  {guide.context_swaps.map((swap, i) => (
                    <ContextSwapCard
                      key={i}
                      original={swap.original}
                      replacement={swap.replacement}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* UDL Adaptations */}
            {guide.udl_adaptations && guide.udl_adaptations.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span>♿</span> UDL Adaptations
                </h3>
                <div className="space-y-2">
                  {guide.udl_adaptations.map((adaptation, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 animate-fade-in"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-500 text-xs font-bold">{i + 1}</span>
                      </div>
                      <p className="text-sm text-blue-800 leading-relaxed">{adaptation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fingerprint context reminder */}
            {fingerprint && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-500">
                <p className="font-semibold text-gray-600 mb-1">Generated for your class</p>
                <p>{fingerprint.year_level} · {fingerprint.topic} · {fingerprint.class_size} students</p>
                {fingerprint.esl_percentage > 0 && (
                  <p>{fingerprint.esl_percentage}% ESL · {fingerprint.ability_level} ability</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-5 py-4 border-t border-gray-100 space-y-2 flex-shrink-0">
        <button
          onClick={onMarkUsed}
          className="w-full bg-gradient-to-r from-teal-500 to-green-500 text-white font-semibold py-3 rounded-xl shadow hover:shadow-md transition-all flex items-center justify-center gap-2"
        >
          <span>✅</span>
          <span>Mark as Used — Get Feedback</span>
        </button>
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-2.5 rounded-xl text-center text-sm text-gray-500 hover:text-teal-600 transition font-medium"
        >
          Open original resource ↗
        </a>
      </div>
    </div>
  );
}
