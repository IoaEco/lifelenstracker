import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import type { IoniconsName } from "@/constants/icons";
import {
  getApiBaseUrl,
  fetchSnapshot,
  pushSync,
  requestUploadUrl,
  type CloudPhoto,
  type CloudTrack,
} from "@/lib/cloudSync";

export interface Track {
  id: string;
  title: string;
  description: string;
  iconName: IoniconsName;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface TrackPhoto {
  id: string;
  trackId: string;
  uri: string;
  takenAt: string;
  updatedAt: string;
  tilt: { x: number; y: number; z: number } | null;
  objectPath?: string | null;
  deleted?: boolean;
}

export type SyncStatus = "idle" | "syncing" | "error";

interface TrackContextType {
  tracks: Track[];
  photos: TrackPhoto[];
  loading: boolean;
  syncStatus: SyncStatus;
  lastSyncError: string | null;
  lastSyncedAt: string | null;
  isCloudEnabled: boolean;
  addTrack: (track: Omit<Track, "id" | "createdAt" | "updatedAt">) => Promise<Track>;
  deleteTrack: (trackId: string) => Promise<void>;
  addPhoto: (
    photo: Omit<TrackPhoto, "id" | "takenAt" | "updatedAt">,
  ) => Promise<TrackPhoto>;
  deletePhoto: (photoId: string) => Promise<void>;
  getTrackPhotos: (trackId: string) => TrackPhoto[];
  getLatestPhoto: (trackId: string) => TrackPhoto | null;
  resolvePhotoSource: (photo: TrackPhoto) => string;
  syncNow: () => Promise<void>;
}

const TrackContext = createContext<TrackContextType | null>(null);

const TRACKS_KEY = "@lifelens:tracks";
const PHOTOS_KEY = "@lifelens:photos";
const LAST_SYNC_KEY = "@lifelens:lastSyncedAt";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function nowIso(): string {
  return new Date().toISOString();
}

function trackToCloud(t: Track): CloudTrack {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    iconName: t.iconName,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    deleted: !!t.deleted,
  };
}

function photoToCloud(p: TrackPhoto): CloudPhoto | null {
  if (!p.objectPath) return null;
  return {
    id: p.id,
    trackId: p.trackId,
    objectPath: p.objectPath,
    takenAt: p.takenAt,
    updatedAt: p.updatedAt,
    deleted: !!p.deleted,
    tiltX: p.tilt?.x ?? null,
    tiltY: p.tilt?.y ?? null,
    tiltZ: p.tilt?.z ?? null,
  };
}

function mergeTracks(local: Track[], cloud: CloudTrack[]): Track[] {
  const byId = new Map<string, Track>();
  for (const t of local) byId.set(t.id, t);
  for (const c of cloud) {
    const existing = byId.get(c.id);
    if (!existing || new Date(c.updatedAt) >= new Date(existing.updatedAt)) {
      byId.set(c.id, {
        id: c.id,
        title: c.title,
        description: c.description,
        iconName: c.iconName as IoniconsName,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        deleted: c.deleted,
      });
    }
  }
  return Array.from(byId.values());
}

function mergePhotos(local: TrackPhoto[], cloud: CloudPhoto[]): TrackPhoto[] {
  const byId = new Map<string, TrackPhoto>();
  for (const p of local) byId.set(p.id, p);
  for (const c of cloud) {
    const existing = byId.get(c.id);
    if (!existing) {
      byId.set(c.id, {
        id: c.id,
        trackId: c.trackId,
        uri: "",
        takenAt: c.takenAt,
        updatedAt: c.updatedAt,
        tilt:
          c.tiltX != null && c.tiltY != null && c.tiltZ != null
            ? { x: c.tiltX, y: c.tiltY, z: c.tiltZ }
            : null,
        objectPath: c.objectPath,
        deleted: c.deleted,
      });
    } else if (new Date(c.updatedAt) >= new Date(existing.updatedAt)) {
      byId.set(c.id, {
        ...existing,
        trackId: c.trackId,
        takenAt: c.takenAt,
        updatedAt: c.updatedAt,
        objectPath: c.objectPath,
        deleted: c.deleted,
      });
    } else if (!existing.objectPath && c.objectPath) {
      byId.set(c.id, { ...existing, objectPath: c.objectPath });
    }
  }
  return Array.from(byId.values());
}

async function uploadPhotoBytes(
  uri: string,
  getToken: () => Promise<string | null>,
): Promise<string> {
  const fileName = uri.split("/").pop() || `photo-${Date.now()}.jpg`;
  const lower = fileName.toLowerCase();
  const contentType = lower.endsWith(".png") ? "image/png" : "image/jpeg";

  const response = await fetch(uri);
  if (!response.ok) throw new Error("Could not read local photo");
  const blob = await response.blob();

  const { uploadURL, objectPath } = await requestUploadUrl(
    { name: fileName, size: blob.size || 0, contentType },
    getToken,
  );

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed (HTTP ${putRes.status})`);
  }
  return objectPath;
}

export function TrackProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [photos, setPhotos] = useState<TrackPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const tracksRef = useRef<Track[]>([]);
  const photosRef = useRef<TrackPhoto[]>([]);
  tracksRef.current = tracks;
  photosRef.current = photos;

  useEffect(() => {
    async function load() {
      try {
        const [tracksData, photosData, syncedAt] = await Promise.all([
          AsyncStorage.getItem(TRACKS_KEY),
          AsyncStorage.getItem(PHOTOS_KEY),
          AsyncStorage.getItem(LAST_SYNC_KEY),
        ]);
        if (tracksData) {
          const parsed = JSON.parse(tracksData) as Track[];
          setTracks(
            parsed.map((t) => ({ ...t, updatedAt: t.updatedAt || t.createdAt })),
          );
        }
        if (photosData) {
          const parsed = JSON.parse(photosData) as TrackPhoto[];
          setPhotos(
            parsed.map((p) => ({ ...p, updatedAt: p.updatedAt || p.takenAt })),
          );
        }
        if (syncedAt) setLastSyncedAt(syncedAt);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const saveTracks = useCallback(async (updated: Track[]) => {
    await AsyncStorage.setItem(TRACKS_KEY, JSON.stringify(updated));
    setTracks(updated);
  }, []);

  const savePhotos = useCallback(async (updated: TrackPhoto[]) => {
    await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(updated));
    setPhotos(updated);
  }, []);

  const syncNow = useCallback(async () => {
    if (!isSignedIn) return;
    setSyncStatus("syncing");
    setLastSyncError(null);
    try {
      // 1. Upload bytes for any local photos that are not in the cloud yet.
      const pendingUploads = photosRef.current.filter(
        (p) => !p.deleted && !p.objectPath && p.uri && !p.uri.startsWith("http"),
      );
      const uploadedById = new Map<string, string>();
      for (const photo of pendingUploads) {
        try {
          const objectPath = await uploadPhotoBytes(photo.uri, getToken);
          uploadedById.set(photo.id, objectPath);
        } catch (err) {
          console.warn("Upload failed for photo", photo.id, err);
        }
      }
      if (uploadedById.size > 0) {
        const updated = photosRef.current.map((p) =>
          uploadedById.has(p.id)
            ? { ...p, objectPath: uploadedById.get(p.id)!, updatedAt: nowIso() }
            : p,
        );
        await savePhotos(updated);
      }

      // 2. Push everything we have locally to the cloud (server merges by updatedAt).
      const localTracks = tracksRef.current.map(trackToCloud);
      const localPhotos = photosRef.current
        .map(photoToCloud)
        .filter((c): c is CloudPhoto => c !== null);

      const merged = await pushSync(
        { tracks: localTracks, photos: localPhotos },
        getToken,
      );

      // 3. Merge server response into local state.
      const mergedTracks = mergeTracks(tracksRef.current, merged.tracks);
      const mergedPhotos = mergePhotos(photosRef.current, merged.photos);
      await saveTracks(mergedTracks);
      await savePhotos(mergedPhotos);

      const ts = nowIso();
      await AsyncStorage.setItem(LAST_SYNC_KEY, ts);
      setLastSyncedAt(ts);
      setSyncStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      setLastSyncError(message);
      setSyncStatus("error");
    }
  }, [isSignedIn, getToken, saveTracks, savePhotos]);

  // Trigger initial sync when the user signs in (or the app boots already signed in).
  useEffect(() => {
    if (!authLoaded || loading) return;
    if (!isSignedIn) {
      setSyncStatus("idle");
      setLastSyncError(null);
      return;
    }
    void syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, isSignedIn, loading]);

  const addTrack = useCallback(
    async (data: Omit<Track, "id" | "createdAt" | "updatedAt">) => {
      const ts = nowIso();
      const track: Track = {
        ...data,
        id: generateId(),
        createdAt: ts,
        updatedAt: ts,
        deleted: false,
      };
      const updated = [...tracksRef.current, track];
      await saveTracks(updated);
      if (isSignedIn) void syncNow();
      return track;
    },
    [saveTracks, isSignedIn, syncNow],
  );

  const deleteTrack = useCallback(
    async (trackId: string) => {
      const ts = nowIso();
      const trackPhotos = photosRef.current.filter((p) => p.trackId === trackId);
      const localPhotoUris = trackPhotos
        .map((p) => p.uri)
        .filter((u) => u && !u.startsWith("http"));

      if (isSignedIn) {
        const updatedTracks = tracksRef.current.map((t) =>
          t.id === trackId ? { ...t, deleted: true, updatedAt: ts } : t,
        );
        const updatedPhotos = photosRef.current.map((p) =>
          p.trackId === trackId ? { ...p, deleted: true, updatedAt: ts } : p,
        );
        await Promise.all([saveTracks(updatedTracks), savePhotos(updatedPhotos)]);
        void syncNow();
      } else {
        const updatedTracks = tracksRef.current.filter((t) => t.id !== trackId);
        const updatedPhotos = photosRef.current.filter((p) => p.trackId !== trackId);
        await Promise.all([saveTracks(updatedTracks), savePhotos(updatedPhotos)]);
      }

      if (Platform.OS !== "web") {
        for (const uri of localPhotoUris) {
          try {
            const file = new File(uri);
            if (file.exists) file.delete();
          } catch {
            // ignore individual delete failures
          }
        }
      }
    },
    [saveTracks, savePhotos, isSignedIn, syncNow],
  );

  const addPhoto = useCallback(
    async (data: Omit<TrackPhoto, "id" | "takenAt" | "updatedAt">) => {
      const ts = nowIso();
      const photo: TrackPhoto = {
        ...data,
        id: generateId(),
        takenAt: ts,
        updatedAt: ts,
        deleted: false,
      };
      const updated = [...photosRef.current, photo];
      await savePhotos(updated);
      if (isSignedIn) void syncNow();
      return photo;
    },
    [savePhotos, isSignedIn, syncNow],
  );

  const deletePhoto = useCallback(
    async (photoId: string) => {
      const photo = photosRef.current.find((p) => p.id === photoId);
      const ts = nowIso();

      if (isSignedIn) {
        const updated = photosRef.current.map((p) =>
          p.id === photoId ? { ...p, deleted: true, updatedAt: ts } : p,
        );
        await savePhotos(updated);
        void syncNow();
      } else {
        const updated = photosRef.current.filter((p) => p.id !== photoId);
        await savePhotos(updated);
      }

      if (photo && photo.uri && !photo.uri.startsWith("http") && Platform.OS !== "web") {
        try {
          const file = new File(photo.uri);
          if (file.exists) file.delete();
        } catch {
          // ignore
        }
      }
    },
    [savePhotos, isSignedIn, syncNow],
  );

  const getTrackPhotos = useCallback(
    (trackId: string) => {
      return photos
        .filter((p) => p.trackId === trackId && !p.deleted)
        .sort(
          (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime(),
        );
    },
    [photos],
  );

  const getLatestPhoto = useCallback(
    (trackId: string) => {
      const trackPhotos = getTrackPhotos(trackId);
      return trackPhotos.length > 0 ? trackPhotos[trackPhotos.length - 1] : null;
    },
    [getTrackPhotos],
  );

  const resolvePhotoSource = useCallback((photo: TrackPhoto) => {
    if (photo.uri && !photo.uri.startsWith("http") && photo.uri.length > 0) {
      return photo.uri;
    }
    if (photo.objectPath) {
      return `${getApiBaseUrl()}/api/storage${photo.objectPath}`;
    }
    return photo.uri;
  }, []);

  const visibleTracks = tracks.filter((t) => !t.deleted);

  return (
    <TrackContext.Provider
      value={{
        tracks: visibleTracks,
        photos,
        loading,
        syncStatus,
        lastSyncError,
        lastSyncedAt,
        isCloudEnabled: !!isSignedIn,
        addTrack,
        deleteTrack,
        addPhoto,
        deletePhoto,
        getTrackPhotos,
        getLatestPhoto,
        resolvePhotoSource,
        syncNow,
      }}
    >
      {children}
    </TrackContext.Provider>
  );
}

export function useTrack() {
  const ctx = useContext(TrackContext);
  if (!ctx) throw new Error("useTrack must be used inside TrackProvider");
  return ctx;
}
