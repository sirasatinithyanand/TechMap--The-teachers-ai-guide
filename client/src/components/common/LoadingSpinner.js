import React from "react";

export function LoadingSpinner({ size = "md", color = "teal" }) {
  const sizes = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12", xl: "w-16 h-16" };
  const colors = {
    teal: "border-teal-500",
    white: "border-white",
    green: "border-green-500",
    gray: "border-gray-400",
  };

  return (
    <div
      className={`${sizes[size]} border-2 border-t-transparent ${colors[color]} rounded-full animate-spin`}
    />
  );
}

export function LoadingOverlay({ message = "Loading..." }) {
  return (
    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-xl">
      <LoadingSpinner size="lg" />
      <p className="mt-3 text-teal-700 font-medium text-sm">{message}</p>
    </div>
  );
}

export function LoadingDots({ message }) {
  return (
    <div className="flex items-center gap-2 text-teal-600">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-teal-500 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      {message && <span className="text-sm font-medium">{message}</span>}
    </div>
  );
}
