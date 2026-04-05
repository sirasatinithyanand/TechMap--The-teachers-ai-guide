import React from "react";

export function SkeletonBar({ width = "100%", height = "h-4", className = "" }) {
  return (
    <div
      className={`bg-gray-200 rounded animate-pulse ${height} ${className}`}
      style={{ width }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonBar height="h-4" width="75%" />
          <SkeletonBar height="h-3" width="50%" />
        </div>
      </div>
      <SkeletonBar height="h-3" />
      <SkeletonBar height="h-3" width="85%" />
      <div className="grid grid-cols-2 gap-2">
        <SkeletonBar height="h-2" />
        <SkeletonBar height="h-2" />
        <SkeletonBar height="h-2" />
        <SkeletonBar height="h-2" />
      </div>
    </div>
  );
}

export function ResourceMarkerSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function ScoreBarSkeleton() {
  return (
    <div className="space-y-4">
      {["Curriculum Alignment", "Local Relevance", "ESL Accessibility", "Source Reliability"].map((label) => (
        <div key={label} className="space-y-1">
          <div className="flex justify-between">
            <SkeletonBar height="h-3" width="40%" />
            <SkeletonBar height="h-3" width="10%" />
          </div>
          <div className="h-3 bg-gray-200 rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  );
}
