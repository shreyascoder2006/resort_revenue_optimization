import { GoogleGenAI, ApiError, Type, type Schema } from "@google/genai";
import { INTENT_VALUES, buildConciergeSystemPrompt, findGuest } from "./concierge-prompt";
import type { ConciergeResponse, Intent } from "./concierge";

const MODEL = "gemini-3.6-flash";

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, format: "enum", enum: [...INTENT_VALUES] },
    reply: { type: Type.STRING, description: "A warm, concise reply to the guest - 2 to 4 sentences, no bullet lists." },
    suggestedActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "At most 3 short imperative staff actions, e.g. 'Hold table at Azure'. Empty array if no action is needed.",
    },
  },
  required: ["intent", "reply", "suggestedActions"],
};

interface ParsedConciergeReply {
  intent: string;
  reply: string;
  suggestedActions: string[];
}

let cachedClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

function isKnownIntent(value: string): value is Intent {
  return (INTENT_VALUES as readonly string[]).includes(value);
}

function isTransient(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 503 || error.status === 429);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls the real Gemini API for a grounded, conversational reply.
 * Retries once on a transient overload/rate-limit response (common on the
 * "-latest" model aliases under load). Returns null (never throws) when no
 * API key is configured or the call still fails, so callers can fall back
 * to another provider or the rule-based engine.
 */
export async function handleConciergeMessageGemini(message: string, guestId?: string): Promise<ConciergeResponse | null> {
  const ai = getClient();
  if (!ai) return null;

  const guest = findGuest(guestId);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: message,
        config: {
          systemInstruction: buildConciergeSystemPrompt(guest),
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 1024,
        },
      });

      const text = response.text;
      if (!text) return null;

      const parsed = JSON.parse(text) as ParsedConciergeReply;
      const intent: Intent = isKnownIntent(parsed.intent) ? parsed.intent : "unknown";

      return {
        intent,
        confidence: 0.95,
        reply: parsed.reply,
        suggestedActions: parsed.suggestedActions ?? [],
        source: "llm",
      };
    } catch (error) {
      if (attempt === 0 && isTransient(error)) {
        await sleep(600);
        continue;
      }
      console.error("Concierge Gemini call failed, falling back:", error);
      return null;
    }
  }
  return null;
}
