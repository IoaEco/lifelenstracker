import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import * as FileSystem from "expo-file-system";
import { File } from "expo-file-system";
import { AppState, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
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

export interface Measurement {
  label: string;
  unit: string;
}

export interface Track {
  id: string;
  title: string;
  description: string;
  iconName: IoniconsName;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
  measurement?: Measurement | null;
  lastReferenceId?: string | null;
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
  measurementValue?: number | null;
  measuredVisually?: boolean;
  daySequence?: number;
}

export type SyncStatus = "idle" | "syncing" | "error";

export interface PhotoSource {
  uri: string;
  headers?: Record<string, string>;
}

export type PhotoBackupStatus =
  | "uploading"
  | "backed-up"
  | "failed"
  | "pending"
  | "local-only";

export interface BackupCounts {
  total: number;
  backedUp: number;
  uploading: number;
  failed: number;
  pending: number;
}

interface TrackContextType {
  tracks: Track[];
  photos: TrackPhoto[];
  loading: boolean;
  syncStatus: SyncStatus;
  lastSyncError: string | null;
  lastSyncedAt: string | null;
  isCloudEnabled: boolean;
  cloudBackupEnabled: boolean;
  setCloudBackupEnabled: (enabled: boolean) => Promise<void>;
  backupCounts: BackupCounts;
  getPhotoBackupStatus: (photo: TrackPhoto) => PhotoBackupStatus;
  retryPhotoUpload: (photoId: string) => Promise<void>;
  retryFailedUploads: () => Promise<void>;
  addTrack: (track: Omit<Track, "id" | "createdAt" | "updatedAt">) => Promise<Track>;
  updateTrackMeasurement: (
    trackId: string,
    measurement: Measurement | null,
  ) => Promise<void>;
  deleteTrack: (trackId: string) => Promise<void>;
  addPhoto: (
    photo: Omit<TrackPhoto, "id" | "takenAt" | "updatedAt" | "daySequence">,
  ) => Promise<TrackPhoto>;
  updatePhotoMeasurement: (
    photoId: string,
    value: number | null,
    options?: { measuredVisually?: boolean },
  ) => Promise<void>;
  updateTrackLastReference: (
    trackId: string,
    referenceId: string | null,
  ) => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  getTrackPhotos: (trackId: string) => TrackPhoto[];
  getLatestPhoto: (trackId: string) => TrackPhoto | null;
  resolvePhotoSource: (photo: TrackPhoto) => PhotoSource;
  syncNow: () => Promise<void>;
}

const TrackContext = createContext<TrackContextType | null>(null);

const TRACKS_KEY = "@lifelens:tracks";
const PHOTOS_KEY = "@lifelens:photos";
const LAST_SYNC_KEY = "@lifelens:lastSyncedAt";
const CLOUD_BACKUP_KEY = "@lifelens:cloudBackupEnabled";

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
    measurementLabel: t.measurement?.label ?? null,
    measurementUnit: t.measurement?.unit ?? null,
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
    measurementValue: p.measurementValue ?? null,
  };
}

function cloudToMeasurement(c: CloudTrack): Measurement | null {
  if (c.measurementLabel) {
    return { label: c.measurementLabel, unit: c.measurementUnit ?? "" };
  }
  return null;
}

function mergeTracks(local: Track[], cloud: CloudTrack[]): Track[] {
  const byId = new Map<string, Track>();
  for (const t of local) byId.set(t.id, t);
  for (const c of cloud) {
    const existing = byId.get(c.id);
    if (!existing || new Date(c.updatedAt) >= new Date(existing.updatedAt)) {
      byId.set(c.id, {
        // Preserve local-only fields (e.g., lastReferenceId) that are not
        // round-tripped through the cloud schema.
        ...(existing ?? {}),
        id: c.id,
        title: c.title,
        description: c.description,
        iconName: c.iconName as IoniconsName,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        deleted: c.deleted,
        measurement: cloudToMeasurement(c),
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
        measurementValue: c.measurementValue ?? null,
      });
    } else if (new Date(c.updatedAt) >= new Date(existing.updatedAt)) {
      byId.set(c.id, {
        ...existing,
        trackId: c.trackId,
        takenAt: c.takenAt,
        updatedAt: c.updatedAt,
        objectPath: c.objectPath,
        deleted: c.deleted,
        measurementValue: c.measurementValue ?? null,
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
  const [user, setUser] = useState<any>(undefined);
  const isSignedIn = !!user;
  const authLoaded = user !== undefined;
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      return (await auth.currentUser?.getIdToken()) ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [photos, setPhotos] = useState<TrackPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [failedIds, setFailedIds] = useState<Map<string, string>>(new Map());
  // Token is held in state (not just a ref) so that resolvePhotoSource's
  // identity changes when the token rotates, causing <Image> consumers to
  // rerender with the fresh Authorization header.
  const [authToken, setAuthToken] = useState<string | null>(null);
  // Cloud backup preference (defaults to enabled to preserve existing behavior).
  // When disabled, photos and metadata are kept device-local even when the
  // user is signed in. Toggling back on will trigger a sync to upload anything
  // that piled up while it was off.
  const [cloudBackupEnabled, setCloudBackupEnabledState] = useState<boolean>(true);
  const cloudBackupEnabledRef = useRef<boolean>(true);
  cloudBackupEnabledRef.current = cloudBackupEnabled;
  const cloudActive = !!isSignedIn && cloudBackupEnabled;
  // Cooperative-cancellation token. We bump this whenever the user (or
  // sign-out) revokes cloud access so any in-flight syncNow/uploadPending
  // run can self-abort between async steps instead of completing and
  // uploading data after the user opted out.
  const cloudRunIdRef = useRef<number>(0);

  const tracksRef = useRef<Track[]>([]);
  const photosRef = useRef<TrackPhoto[]>([]);
  const uploadingIdsRef = useRef<Set<string>>(new Set());
  const failedIdsRef = useRef<Map<string, string>>(new Map());
  tracksRef.current = tracks;
  photosRef.current = photos;
  uploadingIdsRef.current = uploadingIds;
  failedIdsRef.current = failedIds;

  const markUploading = useCallback((id: string, on: boolean) => {
    setUploadingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const markFailed = useCallback((id: string, message: string | null) => {
    setFailedIds((prev) => {
      const next = new Map(prev);
      if (message) next.set(id, message);
      else next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [tracksData, photosData, syncedAt, cloudBackupRaw] =
          await Promise.all([
            AsyncStorage.getItem(TRACKS_KEY),
            AsyncStorage.getItem(PHOTOS_KEY),
            AsyncStorage.getItem(LAST_SYNC_KEY),
            AsyncStorage.getItem(CLOUD_BACKUP_KEY),
          ]);
        if (cloudBackupRaw != null) {
          const enabled = cloudBackupRaw !== "false";
          setCloudBackupEnabledState(enabled);
          cloudBackupEnabledRef.current = enabled;
        }
        if (tracksData) {
          const parsed = JSON.parse(tracksData) as Track[];
          setTracks(
            parsed.map((t) => ({ ...t, updatedAt: t.updatedAt || t.createdAt })),
          );
        }
        if (photosData) {
          const parsed = JSON.parse(photosData) as TrackPhoto[];
          const normalized = parsed.map((p) => ({
            ...p,
            updatedAt: p.updatedAt || p.takenAt,
          }));
          const cleaned: TrackPhoto[] = [];
          for (const p of normalized) {
            const uri = p.uri || "";
            let broken = false;
            if (uri && !uri.startsWith("http")) {
              if (Platform.OS === "web") {
                if (uri.startsWith("blob:")) broken = true;
              } else if (uri.includes("lifelens")) {
                // URIs in our permanent app storage directory are never broken —
                // skip the existence check to avoid false-positive drops.
              } else if (uri.startsWith("file://") || uri.startsWith("/")) {
                try {
                  const info = await FileSystem.getInfoAsync(uri);
                  if (!info.exists) {
                    console.warn("[TrackContext] Marking photo as broken (file not found):", uri);
                    broken = true;
                  }
                } catch (e) {
                  console.warn("[TrackContext] Marking photo as broken (getInfoAsync threw):", uri, e);
                  broken = true;
                }
              }
            }
            if (broken) {
              if (p.objectPath) {
                cleaned.push({ ...p, uri: "" });
              }
              // otherwise drop the entry entirely
            } else {
              cleaned.push(p);
            }
          }
          // Retroactively assign daySequence to photos that predate the field.
          let finalPhotos = cleaned;
          if (cleaned.some((p) => !p.daySequence)) {
            const groups = new Map<string, TrackPhoto[]>();
            for (const p of cleaned) {
              const dateKey = new Date(p.takenAt).toISOString().slice(0, 10);
              const key = `${p.trackId}|${dateKey}`;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(p);
            }
            const seqMap = new Map<string, number>();
            for (const group of groups.values()) {
              group.sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());
              group.forEach((p, i) => { if (!p.daySequence) seqMap.set(p.id, i + 1); });
            }
            finalPhotos = cleaned.map((p) =>
              seqMap.has(p.id) ? { ...p, daySequence: seqMap.get(p.id)! } : p,
            );
          }
          setPhotos(finalPhotos);
          if (
            finalPhotos.length !== normalized.length ||
            finalPhotos.some((p, i) => p.uri !== normalized[i]?.uri || p.daySequence !== (normalized[i] as TrackPhoto & { daySequence?: number }).daySequence)
          ) {
            await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(finalPhotos));
          }
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
    tracksRef.current = updated;
    await AsyncStorage.setItem(TRACKS_KEY, JSON.stringify(updated));
    setTracks(updated);
  }, []);

  const savePhotos = useCallback(async (updated: TrackPhoto[]) => {
    photosRef.current = updated;
    await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(updated));
    setPhotos(updated);
  }, []);

  const uploadOne = useCallback(
    async (_photo: TrackPhoto): Promise<boolean> => {
      return false;
    },
    [],
  );

  const uploadPending = useCallback(
    async (_photoIds?: string[]): Promise<{ uploaded: number; failed: number }> => {
      return { uploaded: 0, failed: 0 };
    },
    [],
  );

  const syncNow = useCallback(async () => {
    if (!isSignedIn) return;
    if (!cloudBackupEnabledRef.current) return;
    const myRunId = cloudRunIdRef.current;
    const cancelled = () =>
      !cloudBackupEnabledRef.current || cloudRunIdRef.current !== myRunId;
    setSyncStatus("syncing");
    setLastSyncError(null);
    try {
      // 1. Push everything we have locally to the cloud (server merges by updatedAt).
      const localTracks = tracksRef.current.map(trackToCloud);
      const localPhotos = photosRef.current
        .map(photoToCloud)
        .filter((c): c is CloudPhoto => c !== null);

      const merged = await pushSync(
        { tracks: localTracks, photos: localPhotos },
        getToken,
      );
      if (cancelled()) return;

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
      if (cancelled()) return;
      const message = err instanceof Error ? err.message : "Sync failed";
      setLastSyncError(message);
      setSyncStatus("error");
    }
  }, [isSignedIn, getToken, saveTracks, savePhotos, uploadPending]);

  const retryPhotoUpload = useCallback(
    async (photoId: string) => {
      if (!isSignedIn || !cloudBackupEnabledRef.current) return;
      const photo = photosRef.current.find((p) => p.id === photoId);
      if (!photo || photo.deleted || photo.objectPath) return;
      if (!photo.uri || photo.uri.startsWith("http")) return;
      await uploadOne(photo);
    },
    [isSignedIn, uploadOne],
  );

  const retryFailedUploads = useCallback(async () => {
    if (!isSignedIn || !cloudBackupEnabledRef.current) return;
    const ids = Array.from(failedIdsRef.current.keys());
    if (ids.length === 0) return;
    await uploadPending(ids);
  }, [isSignedIn, uploadPending]);

  const setCloudBackupEnabled = useCallback(
    async (enabled: boolean) => {
      const prev = cloudBackupEnabledRef.current;
      cloudBackupEnabledRef.current = enabled;
      setCloudBackupEnabledState(enabled);
      // Bump the run id so any in-flight sync/upload loop will self-abort
      // at its next checkpoint when the user disables cloud backup.
      if (prev && !enabled) {
        cloudRunIdRef.current += 1;
      }
      try {
        await AsyncStorage.setItem(CLOUD_BACKUP_KEY, enabled ? "true" : "false");
      } catch {
        // ignore — preference will revert after app restart in the rare write failure
      }
      if (enabled && isSignedIn) {
        // Catch up: upload anything that piled up locally and push metadata.
        void syncNow();
      } else if (!enabled) {
        // Stop showing a "syncing" spinner if a sync was queued.
        setSyncStatus("idle");
        setLastSyncError(null);
      }
    },
    [isSignedIn, syncNow],
  );

  // When the user signs out, cancel any in-flight sync the same way we do
  // on a backup-disable toggle, so a queued upload can't land after sign-out.
  useEffect(() => {
    if (!isSignedIn) {
      cloudRunIdRef.current += 1;
    }
  }, [isSignedIn]);

  // Auto-retry failed uploads when device comes back online or app foregrounds.
  useEffect(() => {
    if (!isSignedIn || !cloudBackupEnabled) return;
    const tryAutoRetry = () => {
      if (failedIdsRef.current.size === 0) return;
      void retryFailedUploads();
    };

    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") tryAutoRetry();
    });

    let wasConnected: boolean | null = null;
    const netUnsub = NetInfo.addEventListener((state) => {
      const isConnected = !!state.isConnected;
      if (wasConnected === false && isConnected) tryAutoRetry();
      wasConnected = isConnected;
    });

    let removeOnline: (() => void) | null = null;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handler = () => tryAutoRetry();
      window.addEventListener("online", handler);
      removeOnline = () => window.removeEventListener("online", handler);
    }

    return () => {
      appSub.remove();
      netUnsub();
      if (removeOnline) removeOnline();
    };
  }, [isSignedIn, cloudBackupEnabled, retryFailedUploads]);

  useEffect(() => {
    if (!isSignedIn) {
      setAuthToken(null);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const t = (await auth.currentUser?.getIdToken()) ?? null;
        if (cancelled) return;
        setAuthToken((prev) => (prev === t ? prev : t));
      } catch {
        // ignore — next refresh will retry
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 45_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isSignedIn]);

  // Trigger initial sync when the user signs in (or the app boots already signed in).
  useEffect(() => {
    if (!authLoaded || loading) return;
    if (!isSignedIn || !cloudBackupEnabled) {
      setSyncStatus("idle");
      setLastSyncError(null);
      return;
    }
    void syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, isSignedIn, loading, cloudBackupEnabled]);

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
      if (cloudActive) void syncNow();
      return track;
    },
    [saveTracks, cloudActive, syncNow],
  );

  const updateTrackMeasurement = useCallback(
    async (trackId: string, measurement: Measurement | null) => {
      const ts = nowIso();
      const updated = tracksRef.current.map((t) =>
        t.id === trackId ? { ...t, measurement, updatedAt: ts } : t,
      );
      await saveTracks(updated);
      if (cloudActive) void syncNow();
    },
    [saveTracks, cloudActive, syncNow],
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
            new File(uri).delete();
          } catch {
            // ignore individual delete failures
          }
        }
      }
    },
    [saveTracks, savePhotos, cloudActive, syncNow],
  );

  const addPhoto = useCallback(
    async (data: Omit<TrackPhoto, "id" | "takenAt" | "updatedAt" | "daySequence">) => {
      const ts = nowIso();
      const todayMs = new Date(ts).setHours(0, 0, 0, 0);
      const daySequence =
        photosRef.current.filter((p) => {
          if (p.trackId !== data.trackId || p.deleted) return false;
          return new Date(p.takenAt).setHours(0, 0, 0, 0) === todayMs;
        }).length + 1;
      const photo: TrackPhoto = {
        ...data,
        id: generateId(),
        takenAt: ts,
        updatedAt: ts,
        daySequence,
        deleted: false,
      };
      const updated = [...photosRef.current, photo];
      await savePhotos(updated);
      if (cloudActive) void syncNow();
      return photo;
    },
    [savePhotos, cloudActive, syncNow],
  );

  const updatePhotoMeasurement = useCallback(
    async (
      photoId: string,
      value: number | null,
      options?: { measuredVisually?: boolean },
    ) => {
      const ts = nowIso();
      const updated = photosRef.current.map((p) =>
        p.id === photoId
          ? {
              ...p,
              measurementValue: value,
              measuredVisually:
                value == null
                  ? false
                  : options?.measuredVisually ?? p.measuredVisually ?? false,
              updatedAt: ts,
            }
          : p,
      );
      await savePhotos(updated);
      if (cloudActive) void syncNow();
    },
    [savePhotos, cloudActive, syncNow],
  );

  const updateTrackLastReference = useCallback(
    async (trackId: string, referenceId: string | null) => {
      const updated = tracksRef.current.map((t) =>
        t.id === trackId ? { ...t, lastReferenceId: referenceId } : t,
      );
      await saveTracks(updated);
    },
    [saveTracks],
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
          new File(photo.uri).delete();
        } catch {
          // ignore
        }
      }
    },
    [savePhotos, cloudActive, syncNow],
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

  const resolvePhotoSource = useCallback(
    (photo: TrackPhoto): PhotoSource => {
      if (photo.uri && !photo.uri.startsWith("http") && photo.uri.length > 0) {
        return { uri: photo.uri };
      }
      if (photo.objectPath) {
        return {
          uri: `${getApiBaseUrl()}/api/storage${photo.objectPath}`,
          headers: authToken
            ? { Authorization: `Bearer ${authToken}` }
            : undefined,
        };
      }
      return { uri: photo.uri };
    },
    [authToken],
  );

  const getPhotoBackupStatus = useCallback(
    (photo: TrackPhoto): PhotoBackupStatus => {
      if (!isSignedIn) return "local-only";
      if (photo.objectPath) return "backed-up";
      if (uploadingIds.has(photo.id)) return "uploading";
      if (failedIds.has(photo.id)) return "failed";
      if (photo.uri && !photo.uri.startsWith("http")) return "pending";
      return "local-only";
    },
    [isSignedIn, uploadingIds, failedIds],
  );

  const backupCounts: BackupCounts = (() => {
    let total = 0;
    let backedUp = 0;
    let uploading = 0;
    let failed = 0;
    let pending = 0;
    if (cloudActive) {
      for (const p of photos) {
        if (p.deleted) continue;
        total++;
        if (p.objectPath) backedUp++;
        else if (uploadingIds.has(p.id)) uploading++;
        else if (failedIds.has(p.id)) failed++;
        else if (p.uri && !p.uri.startsWith("http")) pending++;
      }
    }
    return { total, backedUp, uploading, failed, pending };
  })();

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
        isCloudEnabled: cloudActive,
        cloudBackupEnabled,
        setCloudBackupEnabled,
        backupCounts,
        getPhotoBackupStatus,
        retryPhotoUpload,
        retryFailedUploads,
        addTrack,
        updateTrackMeasurement,
        deleteTrack,
        addPhoto,
        updatePhotoMeasurement,
        updateTrackLastReference,
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
