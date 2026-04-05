const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const supabase = require("../services/supabase");
const axios = require("axios");

// POST /api/pulse — save class pulse feedback and update resource score
router.post("/", async (req, res) => {
  try {
    const { resource_id, fingerprint_id, rating } = req.body;

    if (!resource_id || !fingerprint_id || !rating) {
      return res.status(400).json({ error: "resource_id, fingerprint_id, and rating are required" });
    }

    if (!["great", "partial", "missed"].includes(rating)) {
      return res.status(400).json({ error: "rating must be 'great', 'partial', or 'missed'" });
    }

    // Save pulse feedback
    const feedback = {
      id: uuidv4(),
      resource_id,
      fingerprint_id,
      rating,
      created_at: new Date().toISOString(),
    };

    const { error: insertErr } = await supabase.from("pulse_feedback").insert(feedback);
    if (insertErr) throw insertErr;

    // Update resource local_relevance score
    const scoreDelta = rating === "great" ? 5 : rating === "missed" ? -5 : 0;

    if (scoreDelta !== 0) {
      const { data: current, error: fetchErr } = await supabase
        .from("resources")
        .select("local_relevance")
        .eq("id", resource_id)
        .single();

      if (!fetchErr && current) {
        const newScore = Math.max(0, Math.min(100, (current.local_relevance || 50) + scoreDelta));
        await supabase.from("resources").update({ local_relevance: newScore }).eq("id", resource_id);
      }
    }

    res.json({ success: true, feedback });
  } catch (err) {
    console.error("Pulse route error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
