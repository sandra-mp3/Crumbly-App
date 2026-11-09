import { GoogleGenAI, Type } from "@google/genai";
import type { LLMProvider, Msg, ToolDecl } from "./provider.js";
import { env } from "../env.js";
import { HttpError } from "../types.js";

let client: GoogleGenAI | undefined;
function ai(): { client: GoogleGenAI; model: string } {
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) throw new HttpError(503, "Crumbly Bot isn't set up yet.");
  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return { client, model: env.GEMINI_MODEL };
}
const T = { string: Type.STRING, number: Type.NUMBER } as const;

const toDecl = (t: ToolDecl) => ({
  name: t.name, description: t.description,
  parameters: t.parameters && {
    type: Type.OBJECT, required: t.parameters.required,
    properties: Object.fromEntries(Object.entries(t.parameters.properties).map(([k, v]) => [k, { type: T[v.type], description: v.description }])),
  },
});

function toContents(messages: Msg[]) {
  return messages.map((m) => {
    if (m.role === "user") return { role: "user", parts: [{ text: m.text }] };
    if (m.role === "tool") return { role: "user", parts: [{ functionResponse: { name: m.name, response: { result: m.result } } }] };
    return m.raw ?? { role: "model", parts: [{ text: m.text ?? "" }] };
  });
}

export const geminiProvider: LLMProvider = {
  async generate({ system, messages, tools }) {
    const { client: c, model } = ai();
    const res = await c.models.generateContent({
      model,
      contents: toContents(messages) as never,
      config: { systemInstruction: system, tools: tools.length ? [{ functionDeclarations: tools.map(toDecl) }] : undefined },
    });
    const calls = (res.functionCalls ?? []).map((c) => ({ name: c.name ?? "", args: (c.args ?? {}) as Record<string, unknown> }));
    return { text: res.text, calls, raw: res.candidates?.[0]?.content };
  },
};
