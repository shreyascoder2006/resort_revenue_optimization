import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { INTENT_VALUES, buildConciergeSystemPrompt, findGuest } from "./concierge-prompt";
import type { ConciergeResponse, Intent } from "./concierge";

const MODEL = "claude-opus-5";

const ConciergeReplySchema = z.object({
  intent: z.enum(INTENT_VALUES),
  reply: z.string().describe("A warm, concise reply to the guest - 2 to 4 sentences, no bullet lists."),
  suggestedActions: z
    .array(z.string())
    .max(3)
    .describe("Short imperative staff actions, e.g. 'Hold table at Azure'. Empty array if no action is needed."),
});

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!cachedClient) cachedClient = new Anthropic();
  return cachedClient;
}

/**
 * Calls the real Claude API for a grounded, conversational reply.
 * Returns null (never throws) when no API key is configured or the call fails,
 * so callers can fall back to another provider or the rule-based engine.
 */
export async function handleConciergeMessageLLM(message: string, guestId?: string): Promise<ConciergeResponse | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const guest = findGuest(guestId);

  try {
    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: zodOutputFormat(ConciergeReplySchema),
      },
      system: buildConciergeSystemPrompt(guest),
      messages: [{ role: "user", content: message }],
    });

    if (!response.parsed_output) return null;

    return {
      intent: response.parsed_output.intent as Intent,
      confidence: 0.95,
      reply: response.parsed_output.reply,
      suggestedActions: response.parsed_output.suggestedActions,
      source: "llm",
    };
  } catch (error) {
    console.error("Concierge Claude call failed, falling back:", error);
    return null;
  }
}
