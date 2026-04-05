const axios = require("axios");

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

async function searchResources(query, count = 6) {
  const response = await axios.post(
    PERPLEXITY_API_URL,
    {
      model: "llama-3.1-sonar-large-128k-online",
      messages: [
        {
          role: "system",
          content: `You are a teaching resource finder. When given a search query, return exactly ${count} real teaching resources as a JSON array. Each object must have: title (string), url (string, real URL), description (string, 2-3 sentences about the resource). Return ONLY the JSON array, no markdown, no explanation.`,
        },
        {
          role: "user",
          content: `Find ${count} high quality teaching resources for: ${query}. Return as a JSON array of objects with title, url, and description fields.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 2048,
      return_citations: true,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const raw = response.data.choices[0].message.content.trim();
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : parsed.resources || [];
  } catch {
    // Fallback: extract JSON array from text
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [];
  }
}

async function fetchAndSummariseURL(url) {
  const response = await axios.post(
    PERPLEXITY_API_URL,
    {
      model: "llama-3.1-sonar-large-128k-online",
      messages: [
        {
          role: "system",
          content:
            "You are a teaching resource analyser. Given a URL, fetch its content and summarise it as a teaching resource. Return JSON only with fields: title, url (the original URL), description (3-4 sentences about what the resource contains and its educational value), institution (the domain name).",
        },
        {
          role: "user",
          content: `Analyse this URL and summarise it as a teaching resource: ${url}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const raw = response.data.choices[0].message.content.trim();
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}

module.exports = { searchResources, fetchAndSummariseURL };
