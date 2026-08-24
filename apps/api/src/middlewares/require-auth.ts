import type { Request, Response, NextFunction } from "express";

// TODO: loyihangizdagi haqiqiy auth strategiyasi bilan almashtiring
// (masalan JWT verify, session, yoki Clerk/Auth.js middleware)
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  next();
}