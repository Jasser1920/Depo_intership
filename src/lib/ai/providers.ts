import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { Provider } from "../types";

export class AIError extends Error {}

interface Call<T extends z.ZodType> {
  system: string;
  user: string;
  schema: T;
}

async function callClaude<T extends z.ZodType>({ system, user, schema }: Call<T>): Promise<z.infer<T>> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AIError("ANTHROPIC_API_KEY is not set in .env.local");
  const client = new Anthropic();
  try {
    const res = await client.beta.messages.parse({
      model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
      max_tokens: 16000,
      // If a safety classifier declines, the API retries on a recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (res.stop_reason === "refusal") throw new AIError("Claude declined this request. Try rephrasing or use Gemini.");
    if (res.stop_reason === "max_tokens") throw new AIError("Claude's answer was cut off (max_tokens). Try again.");
    if (!res.parsed_output) throw new AIError("Claude returned output that did not match the expected format.");
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AIError("Claude: invalid ANTHROPIC_API_KEY.");
    if (e instanceof Anthropic.RateLimitError) throw new AIError("Claude: rate limited — wait a minute and retry.");
    if (e instanceof Anthropic.APIError) throw new AIError(`Claude API error ${e.status ?? ""}: ${e.message}`);
    throw e;
  }
}

async function callGemini<T extends z.ZodType>({ system, user, schema }: Call<T>): Promise<z.infer<T>> {
  if (!process.env.GEMINI_API_KEY) throw new AIError("GEMINI_API_KEY is not set in .env.local");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  let text: string | undefined;
  try {
    const res = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: user,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
      },
    });
    text = res.text;
  } catch (e) {
    throw new AIError(`Gemini API error: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!text) throw new AIError("Gemini returned an empty response.");
  const parsed = schema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new AIError("Gemini returned output that did not match the expected format.");
  return parsed.data;
}

export function generateStructured<T extends z.ZodType>(provider: Provider, call: Call<T>) {
  return provider === "gemini" ? callGemini(call) : callClaude(call);
}
