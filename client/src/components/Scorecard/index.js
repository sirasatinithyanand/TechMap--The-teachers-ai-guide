import React, { useState, useEffect } from "react";
import { localiseResource, saveResource } from "../../services/api";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { ScoreBarSkeleton } from "../common/SkeletonLoader";
import CompanionGuide from "../CompanionGuide";
import ClassPulse from "../ClassPulse";

function ScoreBar({ label, value, color, delay = 0 }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDisplayed(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className={`text-xs font-bold ${color}`}>{displayed}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out`}
          style={{
            width: `${displayed}%`,
            backgroundColor:
              displayed >= 80 ? "#22c55e" : displayed >= 60 ? "#14b8a6" : displayed >= 40 ? "#facc15" : "#f87171",
          }}
        />
      </div>
    </div>
  );
}

function ScoreBadge({ reliability }) {
  if (reliability > 85) {
    return (
      <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 border border-green-200 rounded-full px-3 py-1 text-xs font-semibold">
        <span>✓</span>
        <span>Verified Publisher</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-3 py-1 text-xs font-semibold">
      <span>⚠</span>
      <span>Unverified Source</span>
    </div>
  );
}

export default function Scorecard({ resource, fingerprint, onClose }) {
  const [scoresVisible, setScoresVisible] = useState(false);
  const [savingToMap, setSavingToMap] = useState(false);
  const [savedToMap, setSavedToMap] = useState(false);
  const [showCompanionGuide, setShowCompanionGuide] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [markedAsUsed, setMarkedAsUsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setScoresVisible(true), 150);
    return () => clearTimeout(timer);
  }, [resource]);

  const handleSaveToMap = async () => {
    if (savedToMap) return;
    setSavingToMap(true);
    try {
      await saveResource(resource.id, fingerprint?.id);
      setSavedToMap(true);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSavingToMap(false);
    }
  };

  const handleMarkAsUsed = () => {
    setMarkedAsUsed(true);
    setShowPulse(true);
  };

  if (showCompanionGuide) {
    return (
      <CompanionGuide
        resource={resource}
        fingerprint={fingerprint}
        onClose={() => setShowCompanionGuide(false)}
        onMarkUsed={handleMarkAsUsed}
      />
    );
  }

  if (showPulse) {
    return (
      <ClassPulse
        resource={resource}
        fingerprint={fingerprint}
        onClose={() => { setShowPulse(false); onClose(); }}
      />
    );
  }

  return (
    <div className="w-[380px] min-w-[340px] h-screen bg-white shadow-2xl border-l border-gray-100 flex flex-col animate-slide-in z-20 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between flex-shrink-0">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1">
            {resource.is_imported && (
              <span className="text-[10px] bg-purple-100 text-purple-600 rounded px-1.5 py-0.5 font-semibold flex-shrink-0">
                🎓 Imported
              </span>
            )}
            <ScoreBadge reliability={resource.source_reliability} />
          </div>
          <h2 className="text-base font-bold text-gray-900 leading-tight mt-2 line-clamp-2">
            {resource.title}
          </h2>
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-teal-500 hover:text-teal-700 truncate block mt-1 transition"
          >
            {resource.url}
          </a>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition flex-shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Imported institution banner */}
      {resource.is_imported && resource.imported_from && (
        <div className="mx-5 mt-3 px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700 font-medium flex items-center gap-2 flex-shrink-0">
          <span>🏛</span>
          <span>External Institution Resource — imported from {resource.imported_from}</span>
        </div>
      )}

      {/* Scores */}
      <div className="px-5 py-4 flex-shrink-0">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Trust Scorecard</h3>
        {scoresVisible ? (
          <div className="space-y-3">
            <ScoreBar label="Curriculum Alignment" value={resource.curriculum_alignment} color="text-green-600" delay={0} />
            <ScoreBar label="Local Relevance" value={resource.local_relevance} color="text-teal-600" delay={150} />
            <ScoreBar label="ESL Accessibility" value={resource.esl_accessibility} color="text-blue-600" delay={300} />
            <ScoreBar label="Source Reliability" value={resource.source_reliability} color="text-purple-600" delay={450} />
          </div>
        ) : (
          <ScoreBarSkeleton />
        )}
      </div>

      {/* Why this? */}
      {resource.why_recommended && (
        <div className="px-5 pb-4 flex-shrink-0">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Why this?</h3>
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
            <p className="text-sm text-teal-800 leading-relaxed">{resource.why_recommended}</p>
          </div>
        </div>
      )}

      {/* Description */}
      {resource.description && (
        <div className="px-5 pb-4 flex-1 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">About this resource</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{resource.description}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-4 border-t border-gray-100 space-y-2 flex-shrink-0 bg-white">
        <button
          onClick={() => setShowCompanionGuide(true)}
          className="w-full bg-gradient-to-r from-teal-500 to-green-500 text-white font-semibold py-3 rounded-xl shadow hover:shadow-md hover:from-teal-600 hover:to-green-600 transition-all flex items-center justify-center gap-2"
        >
          <span>🔄</span>
          <span>Localise This</span>
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleSaveToMap}
            disabled={savingToMap || savedToMap}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 border-2
              ${savedToMap
                ? "border-green-300 bg-green-50 text-green-600"
                : "border-teal-200 text-teal-600 hover:bg-teal-50"
              }`}
          >
            {savingToMap ? (
              <LoadingSpinner size="sm" />
            ) : savedToMap ? (
              <><span>✓</span><span>Saved</span></>
            ) : (
              <><span>📌</span><span>Add to My Map</span></>
            )}
          </button>

          <button
            onClick={handleMarkAsUsed}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition flex items-center justify-center gap-1.5"
          >
            <span>✅</span>
            <span>Mark Used</span>
          </button>
        </div>

        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-2.5 rounded-xl text-center text-sm text-gray-500 hover:text-teal-600 transition font-medium"
        >
          Open resource ↗
        </a>
      </div>
    </div>
  );
}
