import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, tracksTable, photosTable } from "@workspace/db";
import { resolveObjectOwner } from "./storage";
import {
  GetSyncSnapshotResponse,
  PushSyncBody,
  PushSyncResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function toDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

async function loadSnapshot(userId: string) {
  const [tracks, photos] = await Promise.all([
    db.select().from(tracksTable).where(eq(tracksTable.userId, userId)),
    db.select().from(photosTable).where(eq(photosTable.userId, userId)),
  ]);
  return {
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      iconName: t.iconName,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      deleted: t.deleted,
      measurementLabel: t.measurementLabel,
      measurementUnit: t.measurementUnit,
    })),
    photos: photos.map((p) => ({
      id: p.id,
      trackId: p.trackId,
      objectPath: p.objectPath,
      takenAt: p.takenAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      deleted: p.deleted,
      tiltX: p.tiltX,
      tiltY: p.tiltY,
      tiltZ: p.tiltZ,
      measurementValue: p.measurementValue,
    })),
  };
}

router.get("/sync/snapshot", requireAuth, async (req: Request, res: Response) => {
  try {
    const snapshot = await loadSnapshot(req.userId!);
    res.json(GetSyncSnapshotResponse.parse(snapshot));
  } catch (err) {
    req.log.error({ err }, "Failed to load snapshot");
    res.status(500).json({ error: "Failed to load snapshot" });
  }
});

router.post("/sync/push", requireAuth, async (req: Request, res: Response) => {
  const parsed = PushSyncBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid sync payload" });
    return;
  }
  const userId = req.userId!;
  const { tracks, photos } = parsed.data;

  try {
    // Validate object ownership BEFORE writing anything: every objectPath the
    // client wants to attach to a photo row must have been issued to this
    // same user via /storage/uploads/request-url (or bootstrapped as theirs
    // from legacy data). This prevents stealing another user's photo by
    // claiming their objectPath in a sync push.
    const incomingObjectPaths = Array.from(
      new Set(photos.map((p) => p.objectPath).filter((p): p is string => !!p)),
    );
    for (const path of incomingObjectPaths) {
      const owner = await resolveObjectOwner(path);
      if (owner === null || owner === "AMBIGUOUS" || owner !== userId) {
        res
          .status(403)
          .json({ error: "Cannot reference an object you do not own" });
        return;
      }
    }

    for (const track of tracks) {
      const incomingUpdated = toDate(track.updatedAt);
      const existing = await db
        .select()
        .from(tracksTable)
        .where(and(eq(tracksTable.id, track.id), eq(tracksTable.userId, userId)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(tracksTable).values({
          id: track.id,
          userId,
          title: track.title,
          description: track.description,
          iconName: track.iconName,
          createdAt: toDate(track.createdAt),
          updatedAt: incomingUpdated,
          deleted: track.deleted,
          measurementLabel: track.measurementLabel ?? null,
          measurementUnit: track.measurementUnit ?? null,
        });
      } else if (existing[0].updatedAt < incomingUpdated) {
        await db
          .update(tracksTable)
          .set({
            title: track.title,
            description: track.description,
            iconName: track.iconName,
            updatedAt: incomingUpdated,
            deleted: track.deleted,
            measurementLabel: track.measurementLabel ?? null,
            measurementUnit: track.measurementUnit ?? null,
          })
          .where(and(eq(tracksTable.id, track.id), eq(tracksTable.userId, userId)));
      }
    }

    for (const photo of photos) {
      const incomingUpdated = toDate(photo.updatedAt);
      const existing = await db
        .select()
        .from(photosTable)
        .where(and(eq(photosTable.id, photo.id), eq(photosTable.userId, userId)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(photosTable).values({
          id: photo.id,
          userId,
          trackId: photo.trackId,
          objectPath: photo.objectPath,
          takenAt: toDate(photo.takenAt),
          updatedAt: incomingUpdated,
          deleted: photo.deleted,
          tiltX: photo.tiltX ?? null,
          tiltY: photo.tiltY ?? null,
          tiltZ: photo.tiltZ ?? null,
          measurementValue: photo.measurementValue ?? null,
        });
      } else if (existing[0].updatedAt < incomingUpdated) {
        await db
          .update(photosTable)
          .set({
            trackId: photo.trackId,
            objectPath: photo.objectPath,
            takenAt: toDate(photo.takenAt),
            updatedAt: incomingUpdated,
            deleted: photo.deleted,
            tiltX: photo.tiltX ?? null,
            tiltY: photo.tiltY ?? null,
            tiltZ: photo.tiltZ ?? null,
            measurementValue: photo.measurementValue ?? null,
          })
          .where(and(eq(photosTable.id, photo.id), eq(photosTable.userId, userId)));
      }
    }

    const snapshot = await loadSnapshot(userId);
    res.json(PushSyncResponse.parse(snapshot));
  } catch (err) {
    req.log.error({ err }, "Failed to push sync");
    res.status(500).json({ error: "Failed to push sync" });
  }
});

export default router;
