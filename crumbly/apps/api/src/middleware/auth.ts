import type { Request, Response, NextFunction } from "express";
import { auth, db } from "../firebase.js";
import { Actor, HttpError, Role } from "../types.js";

declare module "express-serve-static-core" { interface Request { actor: Actor } }

/** Guests are allowed: browsing never needs a login. A bad token is a 401, a missing one is GUEST. */
export async function attachActor(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) { req.actor = { uid: null, role: "GUEST", bakeryId: null }; return next(); }
    const token = await auth.verifyIdToken(h.slice(7));
    // bakeryId is resolved from the server-side membership record, never from the request.
    const m = await db.collection("bakeryMembers").where("uid", "==", token.uid).where("active", "==", true).limit(1).get();
    const member = m.docs[0]?.data();
    req.actor = member
      ? { uid: token.uid, role: member.role as Role, bakeryId: member.bakeryId as string }
      : { uid: token.uid, role: (token.role as Role) ?? "CUSTOMER", bakeryId: null };
    next();
  } catch { next(new HttpError(401, "Session expired. Please sign in again.")); }
}

export const requireAuth = (req: Request, _r: Response, next: NextFunction) =>
  req.actor.uid ? next() : next(new HttpError(401, "Sign in to continue."));

export const requireBakery = (...roles: Role[]) => (req: Request, _r: Response, next: NextFunction) =>
  req.actor.bakeryId && roles.includes(req.actor.role as Role) ? next() : next(new HttpError(403, "You don't have access to this bakery."));

/** Platform admins only. The ADMIN role comes from a Firebase custom claim that only the server can set. */
export const requireAdmin = (req: Request, _r: Response, next: NextFunction) =>
  req.actor.role === "ADMIN" ? next() : next(new HttpError(403, "You don't have access to this area."));
