import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Onboarding from "./components/Onboarding";
import MapView from "./components/MapView";

function App() {
  return (
    <Router>
      <div className="h-screen w-screen overflow-hidden bg-gray-50">
        <Routes>
          <Route path="/" element={<Onboarding />} />
          <Route path="/map" element={<MapView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
