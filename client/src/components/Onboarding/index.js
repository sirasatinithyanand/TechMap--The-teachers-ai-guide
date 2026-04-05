import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createFingerprint } from "../../services/api";
import { LoadingSpinner } from "../common/LoadingSpinner";

const YEAR_LEVELS = [
  "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6",
  "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12",
  "University",
];

const STEP_META = [
  {
    step: 1,
    emoji: "🏫",
    question: "What year level are you teaching?",
    subtext: "We'll filter resources to match your curriculum stage.",
  },
  {
    step: 2,
    emoji: "👥",
    question: "Describe your class in one sentence.",
    subtext: 'e.g. "28 students, 30% ESL, mixed ability, Western Sydney"',
  },
  {
    step: 3,
    emoji: "📚",
    question: "What topic are you teaching this week?",
    subtext: 'e.g. "ecosystems", "quadratic equations", "WWI causes"',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [yearLevel, setYearLevel] = useState("");
  const [classDescription, setClassDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const meta = STEP_META[step - 1];

  const handleNext = async () => {
    setError("");
    if (step === 1 && !yearLevel) return setError("Please select a year level.");
    if (step === 2 && !classDescription.trim()) return setError("Please describe your class.");
    if (step === 3) {
      if (!topic.trim()) return setError("Please enter a topic.");
      await handleSubmit();
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await createFingerprint({
        year_level: yearLevel,
        class_description: classDescription,
        topic,
      });
      const { fingerprint } = res.data;
      sessionStorage.setItem("teachmap_fingerprint", JSON.stringify(fingerprint));
      navigate("/map");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleNext();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-green-50 flex flex-col items-center justify-center px-6">
      {/* Logo / Brand */}
      <div className="mb-10 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-green-500 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white text-lg font-bold">T</span>
          </div>
          <span className="text-2xl font-bold text-gray-800">
            Teach<span className="text-teal-600">Map</span>
          </span>
        </div>
        <p className="text-gray-500 text-sm">The right resource. For your class. Right now.</p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                s < step
                  ? "bg-teal-500 text-white"
                  : s === step
                  ? "bg-teal-600 text-white ring-4 ring-teal-100"
                  : "bg-gray-200 text-gray-400"
              }`}
            >
              {s < step ? "✓" : s}
            </div>
            {s < 3 && (
              <div
                className={`w-12 h-0.5 transition-all duration-500 ${
                  s < step ? "bg-teal-400" : "bg-gray-200"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Card */}
      <div
        key={step}
        className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-lg animate-fade-in"
      >
        <div className="text-4xl mb-4">{meta.emoji}</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{meta.question}</h2>
        <p className="text-gray-500 text-sm mb-6">{meta.subtext}</p>

        {/* Step 1: Year level dropdown */}
        {step === 1 && (
          <select
            value={yearLevel}
            onChange={(e) => setYearLevel(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50 appearance-none cursor-pointer"
          >
            <option value="">Select a year level…</option>
            {YEAR_LEVELS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}

        {/* Step 2: Class description */}
        {step === 2 && (
          <textarea
            value={classDescription}
            onChange={(e) => setClassDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 28 students, 30% ESL, mixed ability, based in Western Sydney"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50 resize-none"
            autoFocus
          />
        )}

        {/* Step 3: Topic */}
        {step === 3 && (
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. ecosystems and food webs"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50"
            autoFocus
          />
        )}

        {/* Error */}
        {error && (
          <p className="mt-3 text-red-500 text-sm font-medium">{error}</p>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => { setStep((s) => s - 1); setError(""); }}
              className="text-gray-400 hover:text-gray-600 text-sm font-medium transition"
              disabled={loading}
            >
              ← Back
            </button>
          ) : (
            <span />
          )}

          <button
            onClick={handleNext}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500 to-green-500 text-white font-semibold px-6 py-3 rounded-xl shadow-md hover:shadow-lg hover:from-teal-600 hover:to-green-600 transition-all duration-200 disabled:opacity-60"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                <span>Analysing…</span>
              </>
            ) : step === 3 ? (
              <>
                <span>Build My Map</span>
                <span>🗺️</span>
              </>
            ) : (
              <>
                <span>Next</span>
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading state below card */}
      {loading && (
        <div className="mt-6 text-center animate-fade-in">
          <p className="text-teal-600 text-sm font-medium">
            🧠 Claude is building your classroom profile…
          </p>
          <p className="text-gray-400 text-xs mt-1">This takes about 5 seconds</p>
        </div>
      )}

      {/* Footer */}
      <p className="mt-8 text-gray-400 text-xs">
        Your data is used only to personalise your resource map. Never shared.
      </p>
    </div>
  );
}
