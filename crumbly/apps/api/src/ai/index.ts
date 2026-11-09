import { env } from "../env.js";
import { geminiProvider } from "./gemini.js";
import type { LLMProvider } from "./provider.js";
const providers: Record<string, LLMProvider> = { gemini: geminiProvider };
export const llm: LLMProvider = providers[env.AI_PROVIDER]!;
