import { useEffect, useState } from "react";
import { Platform } from "react-native";

export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
}

/**
 * Returns live accelerometer data on native platforms.
 * Always returns { x: 0, y: 0, z: 0 } on web (expo-sensors has no web support).
 */
export function useAccelerometer(): AccelerometerData {
  const [data, setData] = useState<AccelerometerData>({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    if (Platform.OS === "web") return;

    // expo-sensors is only imported at runtime on native to avoid web bundling issues.
    // The type is asserted from the known module shape — no dynamic `any` involved.
    type SensorsModule = {
      Accelerometer: {
        setUpdateInterval(ms: number): void;
        addListener(cb: (d: AccelerometerData) => void): { remove(): void };
      };
    };

    const sensors = require("expo-sensors") as SensorsModule;
    sensors.Accelerometer.setUpdateInterval(100);
    const sub = sensors.Accelerometer.addListener(setData);
    return () => sub.remove();
  }, []);

  return data;
}
