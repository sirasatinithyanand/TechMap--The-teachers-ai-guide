const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
const MODEL = "claude-sonnet-4-5";

async function extractFingerprint(classDescription) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Extract the following from this teacher class description and return as JSON only (no markdown, no explanation):
esl_percentage (number 0-100, default 0 if not mentioned),
class_size (number, default 25 if not mentioned),
ability_level (string: "mixed", "high", or "low"),
location (string, city/state/country if mentioned, else "Australia"),
special_needs (array of strings, e.g. ["autism", "dyslexia"], empty array if none mentioned).

Description: "${classDescription}"`,
      },
    ],
  });

  const raw = message.content[0].text.trim();
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}

async function scoreResource(fingerprint, resource) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Score this teaching resource for a class with the following profile: ${JSON.stringify(fingerprint)}.
Return JSON only (no markdown, no explanation) with these fields:
- curriculum_alignment (0-100)
- local_relevance (0-100)
- esl_accessibility (0-100)
- source_reliability (0-100, give 90+ if domain is abc.net.au, cambridge.org, acara.edu.au, khanacademy.org, edu.au)
- why_recommended (string, 2 sentences max explaining why this suits this specific class)

Resource title: ${resource.title}
Resource URL: ${resource.url}
Resource description: ${resource.description}`,
      },
    ],
  });

  const raw = message.content[0].text.trim();
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}

async function generateCompanionGuide(fingerprint, resource) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are helping a teacher adapt a resource for their specific class.
Teacher profile: ${JSON.stringify(fingerprint)}
Resource: ${resource.title} — ${resource.url}
Description: ${resource.description}

Return JSON only (no markdown, no explanation) with:
- context_swaps: array of objects {original: string, replacement: string} — find 3-5 geographic, cultural, or currency references that could be swapped for locally relevant alternatives
- udl_adaptations: array of 2-3 strings suggesting how to adapt delivery for the class needs
- prep_time_saved_minutes: integer estimate of how many minutes this guide saves the teacher

Focus on Australian context if the school is in Australia. If location is unknown, default to Australian context.`,
      },
    ],
  });

  const raw = message.content[0].text.trim();
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}

module.exports = { extractFingerprint, scoreResource, generateCompanionGuide };
