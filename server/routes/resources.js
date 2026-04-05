const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { scoreResource, generateCompanionGuide } = require("../services/claude");
const { searchResources } = require("../services/perplexity");
const supabase = require("../services/supabase");

// Geocode a location string to lat/lng using Mapbox Geocoding API
async function geocodeLocation(location, mapboxToken) {
  try {
    const axios = require("axios");
    const encoded = encodeURIComponent(location);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${mapboxToken}&limit=1`;
    const resp = await axios.get(url);
    if (resp.data.features && resp.data.features.length > 0) {
      const [lng, lat] = resp.data.features[0].center;
      return { lat, lng };
    }
  } catch (e) {
    console.warn("Geocoding failed:", e.message);
  }
  // Default to Sydney, Australia
  return { lat: -33.8688, lng: 151.2093 };
}

// Spread markers in a radius around base location
function spreadMarker(baseLat, baseLng, index, total) {
  const radius = 0.15;
  const angle = (index / total) * 2 * Math.PI;
  const jitter = Math.random() * 0.05;
  return {
    latitude: baseLat + (radius + jitter) * Math.sin(angle),
    longitude: baseLng + (radius + jitter) * Math.cos(angle),
  };
}

// POST /api/resources/search — find + score resources for a fingerprint
router.post("/search", async (req, res) => {
  try {
    const { fingerprint } = req.body;
    if (!fingerprint) return res.status(400).json({ error: "fingerprint required" });

    const mapboxToken = process.env.MAPBOX_TOKEN;
    const baseCoords = await geocodeLocation(fingerprint.location || "Sydney Australia", mapboxToken);

    // Build Perplexity search query
    const query = `${fingerprint.year_level} ${fingerprint.topic} teaching resources ${fingerprint.location}`;
    const rawResources = await searchResources(query, 6);

    // Score each resource with Claude in parallel
    const scored = await Promise.all(
      rawResources.map(async (r, i) => {
        try {
          const scores = await scoreResource(fingerprint, r);
          const avgScore = Math.round(
            (scores.curriculum_alignment + scores.local_relevance + scores.esl_accessibility + scores.source_reliability) / 4
          );
          const coords = spreadMarker(baseCoords.lat, baseCoords.lng, i, rawResources.length);

          const resource = {
            id: uuidv4(),
            fingerprint_id: fingerprint.id,
            title: r.title,
            url: r.url,
            description: r.description,
            curriculum_alignment: scores.curriculum_alignment,
            local_relevance: scores.local_relevance,
            esl_accessibility: scores.esl_accessibility,
            source_reliability: scores.source_reliability,
            why_recommended: scores.why_recommended,
            avg_score: avgScore,
            latitude: coords.latitude,
            longitude: coords.longitude,
            is_imported: false,
            created_at: new Date().toISOString(),
          };

          // Save to Supabase
          await supabase.from("resources").insert(resource);
          return resource;
        } catch (err) {
          console.error("Scoring error for resource:", r.title, err.message);
          return null;
        }
      })
    );

    const valid = scored.filter(Boolean);
    res.json({ resources: valid, base_coords: baseCoords });
  } catch (err) {
    console.error("Resources search error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/resources/localise — generate companion guide
router.post("/localise", async (req, res) => {
  try {
    const { fingerprint, resource } = req.body;
    if (!fingerprint || !resource) return res.status(400).json({ error: "fingerprint and resource required" });

    const guide = await generateCompanionGuide(fingerprint, resource);
    res.json({ guide });
  } catch (err) {
    console.error("Localise error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/resources/save — save resource to teacher's map
router.post("/save", async (req, res) => {
  try {
    const { resource_id, fingerprint_id } = req.body;
    const { error } = await supabase
      .from("saved_resources")
      .insert({ id: uuidv4(), resource_id, fingerprint_id, created_at: new Date().toISOString() });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/resources/:id/score — update a resource's local_relevance score
router.patch("/:id/score", async (req, res) => {
  try {
    const { delta } = req.body;
    const { data: current, error: fetchErr } = await supabase
      .from("resources")
      .select("local_relevance")
      .eq("id", req.params.id)
      .single();
    if (fetchErr) throw fetchErr;

    const newScore = Math.max(0, Math.min(100, (current.local_relevance || 50) + delta));
    const { error } = await supabase
      .from("resources")
      .update({ local_relevance: newScore })
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true, new_score: newScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
