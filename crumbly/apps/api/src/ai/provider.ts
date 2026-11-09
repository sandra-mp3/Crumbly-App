export interface ToolDecl {
  name: string; description: string;
  parameters?: { type: "object"; properties: Record<string, { type: "string" | "number"; description?: string }>; required?: string[] };
}
export interface ToolCall { name: string; args: Record<string, unknown> }
/** Provider-neutral message. `raw` keeps provider-specific parts so tool-call turns round-trip intact. */
export type Msg =
  | { role: "user"; text: string }
  | { role: "model"; text?: string; calls?: ToolCall[]; raw?: unknown }
  | { role: "tool"; name: string; result: unknown };
export interface LLMProvider {
  generate(a: { system: string; messages: Msg[]; tools: ToolDecl[] }): Promise<{ text?: string; calls: ToolCall[]; raw?: unknown }>;
}
