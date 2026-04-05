const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { scoreResource } = require("../services/curricullm");
const { fetchAndSummariseURL } = require("../services/perplexity");
const supabase = require("../services/supabase");

// POST /api/import — import and score a resource from an institution URL
router.post("/", async (req, res) => {
  try {
    const { url, fingerprint, base_coords } = req.body;

    if (!url || !fingerprint) {
      return res.status(400).json({ error: "url and fingerprint are required" });
    }

    // Use Perplexity to fetch and summarise the URL
    const summarised = await fetchAndSummariseURL(url);

    // Extract domain for display
    let domain = url;
    try {
      domain = new URL(url).hostname;
    } catch {}

    const resource_data = {
      title: summarised.title || `Resource from ${domain}`,
      url: summarised.url || url,
      description: summarised.description || "Imported resource",
    };

    // Score with Claude
    const scores = await scoreResource(fingerprint, resource_data);
    const avgScore = Math.round(
      (scores.curriculum_alignment + scores.local_relevance + scores.esl_accessibility + scores.source_reliability) / 4
    );

    // Place near base coords with slight offset
    const lat = (base_coords?.lat || -33.8688) + (Math.random() - 0.5) * 0.1;
    const lng = (base_coords?.lng || 151.2093) + (Math.random() - 0.5) * 0.1;

    const resource = {
      id: uuidv4(),
      fingerprint_id: fingerprint.id,
      title: resource_data.title,
      url: resource_data.url,
      description: resource_data.description,
      curriculum_alignment: scores.curriculum_alignment,
      local_relevance: scores.local_relevance,
      esl_accessibility: scores.esl_accessibility,
      source_reliability: scores.source_reliability,
      why_recommended: scores.why_recommended,
      avg_score: avgScore,
      latitude: lat,
      longitude: lng,
      is_imported: true,
      imported_from: domain,
      created_at: new Date().toISOString(),
    };

    await supabase.from("resources").insert(resource);

    res.json({ resource });
  } catch (err) {
    console.error("Import route error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
