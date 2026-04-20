import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId =
    (auth?.sessionClaims as { userId?: string } | undefined)?.userId ||
    auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  try {
    await db
      .insert(usersTable)
      .values({ clerkId: userId })
      .onConflictDoNothing();
  } catch (err) {
    req.log.error({ err }, "Failed to upsert user record");
  }
  next();
  void sql; // keep import for future use
}
