import React, { useState } from "react";
import { submitPulse } from "../../services/api";
import { LoadingSpinner } from "../common/LoadingSpinner";

const RATINGS = [
  {
    id: "great",
    emoji: "🟢",
    label: "Worked great",
    subtext: "Students were engaged and on task",
    color: "bg-green-50 border-green-300 hover:bg-green-100",
    activeColor: "bg-green-100 border-green-500 ring-4 ring-green-200",
    textColor: "text-green-700",
    delta: +5,
  },
  {
    id: "partial",
    emoji: "🟡",
    label: "Partially",
    subtext: "Some students benefited, some didn't",
    color: "bg-yellow-50 border-yellow-300 hover:bg-yellow-100",
    activeColor: "bg-yellow-100 border-yellow-500 ring-4 ring-yellow-200",
    textColor: "text-yellow-700",
    delta: 0,
  },
  {
    id: "missed",
    emoji: "🔴",
    label: "Missed the mark",
    subtext: "Didn't land well with this class",
    color: "bg-red-50 border-red-300 hover:bg-red-100",
    activeColor: "bg-red-100 border-red-500 ring-4 ring-red-200",
    textColor: "text-red-700",
    delta: -5,
  },
];

export default function ClassPulse({ resource, fingerprint, onClose }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRate = async (rating) => {
    setSelected(rating.id);
    setLoading(true);
    setError("");
    try {
      await submitPulse(resource.id, fingerprint?.id, rating.id);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save feedback.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[380px] min-w-[340px] h-screen bg-white shadow-2xl border-l border-gray-100 flex flex-col animate-slide-in z-20">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Class Pulse</h2>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{resource?.title}</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {!submitted ? (
          <div className="w-full space-y-4 animate-fade-in">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">💬</div>
              <h3 className="text-xl font-bold text-gray-900">
                Did this resource land well with your class?
              </h3>
              <p className="text-gray-500 text-sm mt-1">
                Your feedback helps TeachMap learn what works for classes like yours.
              </p>
            </div>

            {/* Rating buttons */}
            <div className="space-y-3">
              {RATINGS.map((rating) => (
                <button
                  key={rating.id}
                  onClick={() => !loading && handleRate(rating)}
                  disabled={loading}
                  className={`w-full border-2 rounded-2xl px-5 py-4 text-left transition-all duration-150 flex items-center gap-4 cursor-pointer
                    ${selected === rating.id ? rating.activeColor : rating.color}
                    ${loading ? "opacity-60 cursor-not-allowed" : ""}
                  `}
                >
                  <span className="text-3xl">{rating.emoji}</span>
                  <div className="flex-1">
                    <p className={`font-bold text-base ${rating.textColor}`}>{rating.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{rating.subtext}</p>
                  </div>
                  {loading && selected === rating.id && (
                    <LoadingSpinner size="sm" color="gray" />
                  )}
                  {selected === rating.id && !loading && (
                    <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition mt-2"
            >
              Skip for now
            </button>
          </div>
        ) : (
          /* Thank you state */
          <div className="text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-green-400 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <span className="text-white text-3xl">✓</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900">Thanks!</h3>
            <p className="text-gray-600 text-sm leading-relaxed max-w-xs mx-auto">
              TeachMap just got smarter for teachers like you. Your feedback shapes what surfaces next time.
            </p>

            {/* Score delta badge */}
            {selected === "great" && (
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 rounded-full px-4 py-2 text-sm font-semibold">
                <span>↑</span>
                <span>Local relevance score boosted</span>
              </div>
            )}
            {selected === "missed" && (
              <div className="inline-flex items-center gap-2 bg-red-100 text-red-600 rounded-full px-4 py-2 text-sm font-semibold">
                <span>↓</span>
                <span>Score adjusted — better matches coming</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="mt-4 bg-gradient-to-r from-teal-500 to-green-500 text-white font-semibold px-8 py-3 rounded-xl shadow hover:shadow-md transition-all"
            >
              Back to Map
            </button>
          </div>
        )}
      </div>

      {/* Footer info */}
      {!submitted && (
        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
          <p className="text-xs text-gray-400 text-center">
            🔒 Feedback is anonymous and used only to improve TeachMap
          </p>
        </div>
      )}
    </div>
  );
}
