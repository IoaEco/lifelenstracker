import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { eq } from "drizzle-orm";
import { db, objectOwnersTable, photosTable } from "@workspace/db";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * Resolve the trusted owner of an object path.
 *
 * Returns the Clerk user id of the owner, `null` if the object is unknown to
 * us, or the literal string `"AMBIGUOUS"` when legacy data associates the
 * path with multiple users (never safe to serve).
 *
 * For object paths uploaded after this change, `object_owners` is populated
 * at upload time and that row is authoritative. For legacy object paths
 * created before ownership was tracked, we lazily bootstrap an ownership row
 * from the `photos` table IFF exactly one user has a photo row pointing at
 * that path — preserving access for existing users without trusting future
 * client-sync writes.
 */
export async function resolveObjectOwner(
  objectPath: string,
): Promise<string | null | "AMBIGUOUS"> {
  const owner = await db
    .select({ ownerId: objectOwnersTable.ownerId })
    .from(objectOwnersTable)
    .where(eq(objectOwnersTable.objectPath, objectPath))
    .limit(1);
  if (owner.length > 0) return owner[0].ownerId;

  // Legacy bootstrap: look at existing photo rows for this path. Require
  // exactly one distinct user to avoid promoting a spoofed row.
  const distinctUsers = await db
    .selectDistinct({ userId: photosTable.userId })
    .from(photosTable)
    .where(eq(photosTable.objectPath, objectPath));
  if (distinctUsers.length === 0) return null;
  if (distinctUsers.length > 1) return "AMBIGUOUS";

  const legacyOwner = distinctUsers[0].userId;
  try {
    await db
      .insert(objectOwnersTable)
      .values({ objectPath, ownerId: legacyOwner })
      .onConflictDoNothing();
  } catch {
    // best-effort: next call will re-resolve
  }
  return legacyOwner;
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;
      const userId = req.userId!;

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      // Bind ownership server-side BEFORE the client uploads. This is the
      // single source of truth for object ownership; sync metadata cannot
      // override it.
      await db
        .insert(objectOwnersTable)
        .values({ objectPath, ownerId: userId })
        .onConflictDoNothing();

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const userId = req.userId!;

    // Ownership check uses the server-trusted object_owners table (written at
    // upload time), NOT the client-mutable photos table. This prevents a
    // malicious client from "claiming" someone else's objectPath via sync
    // push and then downloading it.
    const ownerId = await resolveObjectOwner(objectPath);
    if (ownerId === null) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    if (ownerId === "AMBIGUOUS" || ownerId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
