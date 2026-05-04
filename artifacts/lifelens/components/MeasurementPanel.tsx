import React, { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import type { Measurement, TrackPhoto } from "@/context/TrackContext";
import { useColors } from "@/hooks/useColors";

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const fixed = abs >= 100 ? n.toFixed(0) : abs >= 10 ? n.toFixed(1) : n.toFixed(2);
  return fixed.replace(/\.?0+$/, "");
}

export function formatMeasurementValue(value: number | null | undefined, unit: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const num = formatNumber(value);
  return unit ? `${num} ${unit}` : num;
}

export function formatDelta(delta: number, unit: string): string {
  if (!Number.isFinite(delta)) return "—";
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  const num = formatNumber(Math.abs(delta));
  return unit ? `${sign}${num} ${unit}` : `${sign}${num}`;
}

interface ChartPoint {
  x: number;
  y: number;
  value: number;
}

function buildPath(points: ChartPoint[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

interface Props {
  measurement: Measurement;
  photos: TrackPhoto[];
}

export function MeasurementPanel({ measurement, photos }: Props) {
  const colors = useColors();
  const { width: winW } = useWindowDimensions();

  const valuedPhotos = useMemo(
    () =>
      photos
        .filter((p) => p.measurementValue != null && Number.isFinite(p.measurementValue!))
        .sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime()),
    [photos],
  );

  const stats = useMemo(() => {
    if (valuedPhotos.length === 0) return null;
    const values = valuedPhotos.map((p) => p.measurementValue!);
    const first = values[0];
    const last = values[values.length - 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const totalDelta = last - first;
    const prevDelta = values.length >= 2 ? last - values[values.length - 2] : 0;
    const firstDate = new Date(valuedPhotos[0].takenAt);
    const lastDate = new Date(valuedPhotos[valuedPhotos.length - 1].takenAt);
    const daysElapsed = Math.round(
      (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return { first, last, min, max, totalDelta, prevDelta, daysElapsed };
  }, [valuedPhotos]);

  const chartW = Math.min(winW - 32, 600);
  const chartH = 100;
  const pad = 8;

  const points = useMemo<ChartPoint[]>(() => {
    if (valuedPhotos.length === 0) return [];
    const values = valuedPhotos.map((p) => p.measurementValue!);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const innerW = chartW - pad * 2;
    const innerH = chartH - pad * 2;
    if (valuedPhotos.length === 1) {
      return [
        {
          x: pad + innerW / 2,
          y: pad + innerH / 2,
          value: values[0],
        },
      ];
    }
    return valuedPhotos.map((p, i) => ({
      x: pad + (innerW * i) / (valuedPhotos.length - 1),
      y: pad + innerH - ((p.measurementValue! - min) / range) * innerH,
      value: p.measurementValue!,
    }));
  }, [valuedPhotos, chartW]);

  const totalUntracked = photos.length - valuedPhotos.length;

  return (
    <View
      testID="measurement-panel"
      style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            {measurement.label.toUpperCase()}
          </Text>
          <Text style={[styles.bigValue, { color: colors.foreground }]}>
            {stats ? formatMeasurementValue(stats.last, measurement.unit) : "—"}
          </Text>
        </View>
      </View>

      {stats && valuedPhotos.length >= 2 ? (
        <Text
          testID="measurement-progress-summary"
          style={[styles.progressSummary, { color: colors.foreground }]}
        >
          {measurement.label}:{" "}
          <Text style={{ color: stats.totalDelta >= 0 ? colors.primary : colors.foreground }}>
            {formatDelta(stats.totalDelta, measurement.unit)}
          </Text>
          {stats.daysElapsed > 0
            ? ` over ${stats.daysElapsed} ${stats.daysElapsed === 1 ? "day" : "days"}`
            : " (same day)"}
        </Text>
      ) : null}

      {stats ? (
        <View style={styles.deltaRow}>
          <View style={styles.deltaBlock}>
            <Text style={[styles.deltaLabel, { color: colors.mutedForeground }]}>
              SINCE START
            </Text>
            <Text
              style={[
                styles.deltaValue,
                {
                  color:
                    stats.totalDelta === 0
                      ? colors.foreground
                      : stats.totalDelta > 0
                        ? colors.primary
                        : colors.foreground,
                },
              ]}
            >
              {formatDelta(stats.totalDelta, measurement.unit)}
            </Text>
          </View>
          {valuedPhotos.length >= 2 ? (
            <View style={styles.deltaBlock}>
              <Text style={[styles.deltaLabel, { color: colors.mutedForeground }]}>
                LAST CHANGE
              </Text>
              <Text style={[styles.deltaValue, { color: colors.foreground }]}>
                {formatDelta(stats.prevDelta, measurement.unit)}
              </Text>
            </View>
          ) : null}
          <View style={styles.deltaBlock}>
            <Text style={[styles.deltaLabel, { color: colors.mutedForeground }]}>
              RANGE
            </Text>
            <Text style={[styles.deltaValue, { color: colors.foreground }]}>
              {formatNumber(stats.min)}–{formatNumber(stats.max)}
            </Text>
          </View>
        </View>
      ) : null}

      {valuedPhotos.length >= 2 ? (
        <View style={styles.chartWrap}>
          <Svg width={chartW - 24} height={chartH}>
            <Path
              d={buildPath(points)}
              stroke={colors.primary}
              strokeWidth={2}
              fill="none"
            />
            {points.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i === points.length - 1 ? 4 : 2.5}
                fill={colors.primary}
              />
            ))}
          </Svg>
        </View>
      ) : valuedPhotos.length === 1 ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Add another measurement to see your trend.
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Each photo can have a measurement attached — enter it right after taking the photo, or tap the pencil icon on any photo to add it later. Make sure to configure a unit and label first.
        </Text>
      )}

      {totalUntracked > 0 && valuedPhotos.length > 0 ? (
        <Text style={[styles.subHint, { color: colors.mutedForeground }]}>
          {totalUntracked} photo{totalUntracked === 1 ? "" : "s"} without a value · tap a
          photo in the timeline to add one.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  bigValue: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  progressSummary: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  deltaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  deltaBlock: {
    minWidth: 90,
  },
  deltaLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  deltaValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  chartWrap: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  hint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  subHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
