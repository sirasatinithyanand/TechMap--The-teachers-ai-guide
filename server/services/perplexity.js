// Resource discovery powered by CurricuLLM (no Perplexity needed)
// CurricuLLM has strong knowledge of Australian curriculum resources,
// so we use it to suggest real resources for a given topic/year level.

const axios = require("axios");
const { resolveModel, resolveStage } = require("./curricullm");

const BASE_URL = "https://api.curricullm.com/v1";

async function curricullmChat(messages, fingerprint = null, max_tokens = 2048) {
  const model = resolveModel(fingerprint?.location);
  const stage = fingerprint ? resolveStage(fingerprint.year_level) : "Stage 4";
  const subject = fingerprint?.topic || "General";

  const payload = {
    model,
    messages,
    temperature: 0.3,
    max_tokens,
    response_format: { type: "json_object" },
    curriculum: { stage, subject },
  };

  const response = await axios.post(`${BASE_URL}/chat/completions`, payload, {
    headers: {
      Authorization: `Bearer ${process.env.CURRICULLM_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  const raw = response.data.choices[0].message.content.trim();
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}

// Search for teaching resources using CurricuLLM's curriculum knowledge
async function searchResources(query, count = 6, fingerprint = null) {
  const result = await curricullmChat(
    [
      {
        role: "system",
        content: `You are an expert Australian curriculum resource finder. Return a JSON object with a "resources" array containing exactly ${count} teaching resources. Each resource must have: title (string), url (string — use real known domains like abc.net.au, acara.edu.au, khanacademy.org, teachstarter.com, scootle.edu.au, raiseyourhand.com.au, education.nsw.gov.au, cambridge.org, readwritethink.org), description (2-3 sentences about the resource and its educational value). Only return the JSON object.`,
      },
      {
        role: "user",
        content: `Find ${count} high-quality teaching resources for: ${query}. Return as JSON with a "resources" array.`,
      },
    ],
    fingerprint
  );

  const resources = result.resources || result;
  return Array.isArray(resources) ? resources : [];
}

// Summarise an external institution URL using CurricuLLM
async function fetchAndSummariseURL(url, fingerprint = null) {
  let domain = url;
  try { domain = new URL(url).hostname; } catch {}

  const result = await curricullmChat(
    [
      {
        role: "system",
        content:
          "You are an expert at analysing teaching resources from institutions. Given a URL, describe what type of resource it likely is based on the domain and path, and summarise its educational value. Return JSON only with fields: title (string), url (the original URL as-is), description (3-4 sentences about the educational content and value), institution (the domain name).",
      },
      {
        role: "user",
        content: `Analyse and summarise this teaching resource URL: ${url}\nDomain: ${domain}`,
      },
    ],
    fingerprint,
    512
  );

  return result;
}

module.exports = { searchResources, fetchAndSummariseURL };
