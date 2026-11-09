import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { env } from "./env.js";
import { attachActor } from "./middleware/auth.js";
import { bot } from "./routes/bot.js";
import { catalog } from "./routes/catalog.js";
import { orders } from "./routes/orders.js";
import { business } from "./routes/business.js";
import { maps } from "./routes/maps.js";
import { social } from "./routes/social.js";
import { custom } from "./routes/custom.js";
import { onboarding } from "./routes/onboarding.js";
import { admin } from "./routes/admin.js";
import { team } from "./routes/team.js";
import { money } from "./routes/money.js";
import { notifications } from "./routes/notifications.js";
import { account } from "./routes/account.js";
import { seo } from "./routes/seo.js";
import { internal } from "./routes/internal.js";
import { payments } from "./routes/payments.js";
import { HttpError } from "./types.js";

const app = express();
app.set("trust proxy", env.TRUST_PROXY_HOPS); // set to 1 behind Cloud Run / Render / Railway, otherwise every user shares one rate-limit bucket
app.use(helmet(), cors({ origin: env.WEB_URL, credentials: true }), express.json({ limit: "100kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120 }));
app.use(rateLimit({ windowMs: 60_000, limit: 60 }), seo);
app.use("/api/maps", rateLimit({ windowMs: 60_000, limit: 40 }));
app.use("/api/crumbly-bot", rateLimit({ windowMs: 60_000, limit: 20 }));
app.use("/api", attachActor, catalog, notifications, account, money, team, admin, internal, onboarding, social, maps, custom, orders, business, payments, bot);
app.get("/health", (_q, r) => void r.json({ ok: true }));

app.use((err: unknown, _q: express.Request, res: express.Response, _n: express.NextFunction) => {
  if (err instanceof ZodError) return void res.status(400).json({ ok: false, error: "Invalid request", details: err.flatten() });
  if (err instanceof HttpError) return void res.status(err.status).json({ ok: false, error: err.message });
  console.error(JSON.stringify({ level: "error", msg: err instanceof Error ? err.message : "unknown" })); // no secrets, no stacks to client
  res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
});
app.listen(env.PORT, () => console.log(JSON.stringify({ level: "info", msg: `api on ${env.PORT}` })));
