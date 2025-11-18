import express from "express";
import OpenAI from "openai";
import { authenticateToken } from "./auth.js";

const router = express.Router();
const apiKey = process.env.OPENAI_API_KEY;
let openai = null;
if (apiKey) {
  openai = new OpenAI({ apiKey });
} else {
  // Avoid throwing during module import; warn and let routes respond with 503
  console.warn("OPENAI_API_KEY is not set; AI routes will return 503 until configured.");
}

// Grammar check
router.post("/grammar-check", authenticateToken, async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: "AI service not configured" });
    }
    const { text } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a grammar checker. Return a JSON object with 'corrected' text and 'suggestions' array containing objects with 'original', 'suggestion', and 'reason' fields. Only suggest changes if there are actual grammar or spelling errors.",
        },
        {
          role: "user",
          content: `Check this text for grammar and spelling errors: "${text}"`,
        },
      ],
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json(result);
  } catch (error) {
    console.error("Grammar check error:", error);
    res.status(500).json({ error: "Grammar check failed" });
  }
});

// Text completion
router.post("/complete", authenticateToken, async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: "AI service not configured" });
    }
    const { text, context } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a writing assistant. Given the context and partial text, provide 3 different completions that naturally continue the text. Return a JSON object with 'completions' array containing the suggestions.",
        },
        {
          role: "user",
          content: `Context: ${context}\n\nPartial text: "${text}"\n\nProvide 3 natural completions for this text.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json(result);
  } catch (error) {
    console.error("Text completion error:", error);
    res.status(500).json({ error: "Text completion failed" });
  }
});

// Translation
router.post("/translate", authenticateToken, async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: "AI service not configured" });
    }
    const { text, targetLanguage, sourceLanguage } = req.body;

    const direction = sourceLanguage
      ? `Translate from ${sourceLanguage} to ${targetLanguage}`
      : `Translate to ${targetLanguage} (auto-detect source language)`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. ${direction}. Return only the translated text, maintaining the original tone and basic formatting.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.3,
    });

    res.json({ translation: completion.choices[0].message.content.trim() });
  } catch (error) {
    console.error("Translation error:", error);
    res.status(500).json({ error: "Translation failed" });
  }
});

// Content summarization
router.post("/summarize", authenticateToken, async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: "AI service not configured" });
    }
    const { text, length = "medium" } = req.body;

    const lengthMap = {
      short: "in 2-3 sentences",
      medium: "in 1-2 paragraphs",
      long: "in 3-4 paragraphs",
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a content summarizer. Summarize the given text ${lengthMap[length]}, capturing the main points and key information.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.5,
    });

    res.json({ summary: completion.choices[0].message.content.trim() });
  } catch (error) {
    console.error("Summarization error:", error);
    res.status(500).json({ error: "Summarization failed" });
  }
});

// Minutes of Meeting (MoM)
router.post("/mom", authenticateToken, async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ error: "AI service not configured" });
    }
    const { notes = "", participants = [], documentTitle = "", context = "", minimal = false } = req.body || {};

    const system = minimal
      ? `You are an expert meeting assistant. Produce Minutes of Meeting content ONLY.
Rules:
- Output Markdown bullets and short paragraphs only.
- Do NOT include any headings or labels (no 'Agenda', 'Decisions', 'Action Items', 'Title', 'Date', 'Participants').
- Keep it concise and specific. Combine duplicates.
- Action items should be clear and actionable; if assignee or due date appears, include inline like "(Owner: Name, Due: 12 Jan)".
- Prefer hyphen bullets ('- ...'). Use numbered lists only when strictly helpful.
- No intro, no closing, no metadata. Content only.`
      : `You are an expert meeting assistant. Create concise, well-structured Minutes of Meeting.
Return clean Markdown with the following sections (only include sections that have content):

Title: Minutes of Meeting${documentTitle ? ` - ${documentTitle}` : ""}
Date: {today's date}
Participants: comma-separated list

Agenda
Decisions
Action Items (with assignees and due dates if mentioned)
Discussion Summary
Next Steps
Risks/Blockers
`;

    const userPrompt = `Participants: ${participants.join(", ") || "N/A"}
Context (optional): ${context || "N/A"}
Raw Notes:
"""
${notes || "(no additional notes provided)"}
"""

Generate the MoM in Markdown. Keep it concise and useful.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      temperature: minimal ? 0.3 : 0.4,
      max_tokens: minimal ? 1200 : 900,
    });

    let mom = completion.choices?.[0]?.message?.content?.trim() || "";

    // Sanitize in minimal mode: drop headings/labels if the model added any
    if (minimal && mom) {
      const lines = mom.split(/\r?\n/);
      const filtered = lines
        .filter((ln) => ln.trim() !== "")
        .filter((ln) => !/^\s*#{1,6}\s/.test(ln))
        .filter((ln) => !/^\s*(Title|Date|Participants|Agenda|Decisions|Action Items|Discussion Summary|Next Steps|Risks)\s*:/.test(ln));
      mom = filtered.join("\n").trim();
    }

    // Fallback if still empty: derive simple bullets from notes
    if (!mom) {
      const fallback = (notes || context || "").split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 20)
        .map((l) => `- ${l}`)
        .join("\n");
      mom = fallback || "- Meeting notes unavailable.";
    }

    res.json({ mom });
  } catch (error) {
    console.error("MoM generation error:", error);
    res.status(500).json({ error: "MoM generation failed" });
  }
});

export default router;
