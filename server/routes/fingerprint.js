const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { extractFingerprint } = require("../services/claude");
const supabase = require("../services/supabase");

// POST /api/fingerprint — create a classroom fingerprint
router.post("/", async (req, res) => {
  try {
    const { year_level, class_description, topic } = req.body;

    if (!year_level || !class_description || !topic) {
      return res.status(400).json({ error: "year_level, class_description, and topic are required" });
    }

    // Call Claude to extract structured fingerprint from free text
    const extracted = await extractFingerprint(class_description);

    const fingerprint = {
      id: uuidv4(),
      year_level,
      class_description,
      topic,
      esl_percentage: extracted.esl_percentage ?? 0,
      class_size: extracted.class_size ?? 25,
      ability_level: extracted.ability_level ?? "mixed",
      location: extracted.location ?? "Australia",
      special_needs: extracted.special_needs ?? [],
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("fingerprints").insert(fingerprint);
    if (error) throw error;

    res.json({ fingerprint });
  } catch (err) {
    console.error("Fingerprint route error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fingerprint/:id — retrieve a fingerprint
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("fingerprints")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.json({ fingerprint: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
