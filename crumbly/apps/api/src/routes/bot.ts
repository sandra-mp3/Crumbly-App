import { Router } from "express";
import { z } from "zod";
import { runAssistant } from "../ai/assistant.js";

export const bot = Router();
const body = z.object({
  message: z.string().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(2000) })).max(20).default([]),
});
// Works for guests (discovery) and signed-in users. Any bakeryId in the body is ignored on purpose.
bot.post("/crumbly-bot/chat", async (req, res, next) => {
  try {
    const { message, history } = body.parse(req.body);
    res.json({ ok: true, data: await runAssistant(req.actor, history, message) });
  } catch (e) { next(e); }
});
