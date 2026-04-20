import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import type { IoniconsName } from "@/constants/icons";

export interface Track {
  id: string;
  title: string;
  description: string;
  iconName: IoniconsName;
  createdAt: string;
}

export interface TrackPhoto {
  id: string;
  trackId: string;
  uri: string;
  takenAt: string;
  tilt: { x: number; y: number; z: number } | null;
}

interface TrackContextType {
  tracks: Track[];
  photos: TrackPhoto[];
  loading: boolean;
  addTrack: (track: Omit<Track, "id" | "createdAt">) => Promise<Track>;
  deleteTrack: (trackId: string) => Promise<void>;
  addPhoto: (photo: Omit<TrackPhoto, "id" | "takenAt">) => Promise<TrackPhoto>;
  deletePhoto: (photoId: string) => Promise<void>;
  getTrackPhotos: (trackId: string) => TrackPhoto[];
  getLatestPhoto: (trackId: string) => TrackPhoto | null;
}

const TrackContext = createContext<TrackContextType | null>(null);

const TRACKS_KEY = "@lifelens:tracks";
const PHOTOS_KEY = "@lifelens:photos";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function TrackProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [photos, setPhotos] = useState<TrackPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [tracksData, photosData] = await Promise.all([
          AsyncStorage.getItem(TRACKS_KEY),
          AsyncStorage.getItem(PHOTOS_KEY),
        ]);
        if (tracksData) setTracks(JSON.parse(tracksData));
        if (photosData) setPhotos(JSON.parse(photosData));
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

  const addTrack = useCallback(
    async (data: Omit<Track, "id" | "createdAt">) => {
      const track: Track = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updated = [...tracks, track];
      await saveTracks(updated);
      return track;
    },
    [tracks, saveTracks]
  );

  const deleteTrack = useCallback(
    async (trackId: string) => {
      const trackPhotoUris = photos
        .filter((p) => p.trackId === trackId)
        .map((p) => p.uri);
      const updatedTracks = tracks.filter((t) => t.id !== trackId);
      const updatedPhotos = photos.filter((p) => p.trackId !== trackId);
      await Promise.all([saveTracks(updatedTracks), savePhotos(updatedPhotos)]);
      if (Platform.OS !== "web") {
        for (const uri of trackPhotoUris) {
          try {
            const file = new File(uri);
            if (file.exists) file.delete();
          } catch {
            // ignore individual delete failures
          }
        }
      }
    },
    [tracks, photos, saveTracks, savePhotos]
  );

  const addPhoto = useCallback(
    async (data: Omit<TrackPhoto, "id" | "takenAt">) => {
      const photo: TrackPhoto = {
        ...data,
        id: generateId(),
        takenAt: new Date().toISOString(),
      };
      const updated = [...photos, photo];
      await savePhotos(updated);
      return photo;
    },
    [photos, savePhotos]
  );

  const deletePhoto = useCallback(
    async (photoId: string) => {
      const photo = photos.find((p) => p.id === photoId);
      const updated = photos.filter((p) => p.id !== photoId);
      await savePhotos(updated);
      if (photo && Platform.OS !== "web") {
        try {
          const file = new File(photo.uri);
          if (file.exists) file.delete();
        } catch {
          // ignore
        }
      }
    },
    [photos, savePhotos]
  );

  const getTrackPhotos = useCallback(
    (trackId: string) => {
      return photos
        .filter((p) => p.trackId === trackId)
        .sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());
    },
    [photos]
  );

  const getLatestPhoto = useCallback(
    (trackId: string) => {
      const trackPhotos = getTrackPhotos(trackId);
      return trackPhotos.length > 0 ? trackPhotos[trackPhotos.length - 1] : null;
    },
    [getTrackPhotos]
  );

  return (
    <TrackContext.Provider
      value={{
        tracks,
        photos,
        loading,
        addTrack,
        deleteTrack,
        addPhoto,
        deletePhoto,
        getTrackPhotos,
        getLatestPhoto,
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
