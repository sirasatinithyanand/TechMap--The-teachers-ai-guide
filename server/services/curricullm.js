const axios = require("axios");

const BASE_URL = "https://api.curricullm.com/v1";

// Map year level strings to curriculum stages and models
function resolveStage(yearLevel) {
  const map = {
    "Year 1": "Stage 1", "Year 2": "Stage 1",
    "Year 3": "Stage 2", "Year 4": "Stage 2",
    "Year 5": "Stage 3", "Year 6": "Stage 3",
    "Year 7": "Stage 4", "Year 8": "Stage 4",
    "Year 9": "Stage 5", "Year 10": "Stage 5",
    "Year 11": "Stage 6", "Year 12": "Stage 6",
    "University": "Tertiary",
  };
  return map[yearLevel] || "Stage 4";
}

// Pick the most relevant CurricuLLM model based on location
function resolveModel(location = "") {
  const loc = location.toLowerCase();
  if (loc.includes("victoria") || loc.includes("vic") || loc.includes("melbourne")) {
    return "CurricuLLM-AU-VIC";
  }
  if (loc.includes("western australia") || loc.includes(" wa") || loc.includes("perth")) {
    return "CurricuLLM-AU-WA";
  }
  if (loc.includes("new zealand") || loc.includes("nz") || loc.includes("auckland") || loc.includes("wellington")) {
    return "CurricuLLM-NZ";
  }
  return "CurricuLLM-AU";
}

async function chat({ messages, fingerprint, temperature = 0.2, max_tokens = 1024 }) {
  const model = resolveModel(fingerprint?.location);
  const stage = resolveStage(fingerprint?.year_level);

  // Infer subject from the topic — use the topic directly as subject hint
  const subject = fingerprint?.topic || "General";

  const payload = {
    model,
    messages,
    temperature,
    max_tokens,
    response_format: { type: "json_object" },
    curriculum: {
      stage,
      subject,
    },
  };

  const response = await axios.post(`${BASE_URL}/chat/completions`, payload, {
    headers: {
      Authorization: `Bearer ${process.env.CURRICULLM_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const raw = response.data.choices[0].message.content.trim();
  // Strip markdown fences if present
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}

// Score a resource against a classroom fingerprint
async function scoreResource(fingerprint, resource) {
  return chat({
    fingerprint,
    max_tokens: 512,
    messages: [
      {
        role: "system",
        content:
          "You are an expert Australian curriculum resource evaluator. Score teaching resources based on classroom context and return valid JSON only. No explanations outside the JSON.",
      },
      {
        role: "user",
        content: `Score this teaching resource for a class with the following profile:
${JSON.stringify(fingerprint, null, 2)}

Return JSON with exactly these fields:
{
  "curriculum_alignment": <integer 0-100>,
  "local_relevance": <integer 0-100>,
  "esl_accessibility": <integer 0-100>,
  "source_reliability": <integer 0-100, give 90+ if domain is abc.net.au, cambridge.org, acara.edu.au, khanacademy.org, edu.au>,
  "why_recommended": "<2 sentences explaining why this suits this specific class>"
}

Resource title: ${resource.title}
Resource URL: ${resource.url}
Resource description: ${resource.description}`,
      },
    ],
  });
}

// Generate a localisation companion guide for a resource
async function generateCompanionGuide(fingerprint, resource) {
  return chat({
    fingerprint,
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content:
          "You are an expert Australian curriculum adaptor. Help teachers localise and adapt teaching resources using the UDL framework. Return valid JSON only.",
      },
      {
        role: "user",
        content: `Adapt this resource for the teacher's specific class using the UDL framework.

Teacher profile:
${JSON.stringify(fingerprint, null, 2)}

Resource: ${resource.title}
URL: ${resource.url}
Description: ${resource.description}

Return JSON with exactly these fields:
{
  "context_swaps": [
    { "original": "<geographic/cultural/currency reference>", "replacement": "<Australian/local alternative>" }
  ],
  "udl_adaptations": ["<adaptation string>", "<adaptation string>"],
  "prep_time_saved_minutes": <integer>
}

Rules:
- Provide 3-5 context_swaps (geographic, cultural, or currency references swapped for local alternatives)
- Provide 2-3 udl_adaptations tailored to this class's ESL percentage, ability level, and special needs
- Focus on Australian context. If location mentions VIC/NSW/QLD/WA, use state-specific curriculum references
- prep_time_saved_minutes should reflect realistic teacher prep time saved (typically 15-45 minutes)`,
      },
    ],
  });
}

// Extract structured fingerprint from free-text class description
async function extractFingerprint(classDescription) {
  return chat({
    fingerprint: null,
    max_tokens: 512,
    messages: [
      {
        role: "system",
        content:
          "You are an expert at parsing teacher class descriptions into structured data. Return valid JSON only.",
      },
      {
        role: "user",
        content: `Extract structured data from this teacher class description and return JSON with exactly these fields:
{
  "esl_percentage": <integer 0-100, default 0 if not mentioned>,
  "class_size": <integer, default 25 if not mentioned>,
  "ability_level": <"mixed" | "high" | "low">,
  "location": <"city, state, country" string, default "Sydney, NSW, Australia" if not mentioned>,
  "special_needs": [<array of strings like "autism", "dyslexia", "ADHD">, empty array if none mentioned]
}

Description: "${classDescription}"`,
      },
    ],
  });
}

module.exports = { scoreResource, generateCompanionGuide, extractFingerprint, resolveModel, resolveStage };
