import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTheme } from '../theme';
import { formatBytes } from '../../lib/format';
import { Text } from './Text';

export type RingSegment = {
  id: string;
  color: string;
  /** Contribution of this segment, in bytes. */
  bytes: number;
};

type Props = {
  segments: readonly RingSegment[];
  /**
   * Denominator for the arc lengths. Defaults to the sum of segments, which
   * makes the ring a full circle showing the reclaimable breakdown. Pass total
   * device capacity instead to show reclaimable space in proportion to the disk.
   */
  capacityBytes?: number;
  size?: number;
  strokeWidth?: number;
  /** Small caps line under the figure, e.g. "GB TO FREE". */
  caption?: string;
};

/**
 * The dashboard's signature element: one ring, segmented by category, doubling
 * as the legend for the category colours used on every downstream screen.
 *
 * Arcs are drawn with stroke-dasharray offsets rather than paths — cheaper to
 * compute and exact at any radius.
 */
export const StorageRing: React.FC<Props> = ({
  segments,
  capacityBytes,
  size = 200,
  strokeWidth = 16,
  caption = 'to free',
}) => {
  const theme = useTheme();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const { arcs, totalBytes } = useMemo(() => {
    const total = segments.reduce((sum, s) => sum + Math.max(0, s.bytes), 0);
    const denominator = capacityBytes && capacityBytes > 0 ? capacityBytes : total;

    if (denominator <= 0) {
      return { arcs: [] as Array<RingSegment & { length: number; offset: number }>, totalBytes: 0 };
    }

    let consumed = 0;
    const laid = segments
      .filter(s => s.bytes > 0)
      .map(s => {
        const length = (s.bytes / denominator) * circumference;
        const arc = { ...s, length, offset: -consumed };
        consumed += length;
        return arc;
      });

    return { arcs: laid, totalBytes: total };
  }, [segments, capacityBytes, circumference]);

  const formatted = formatBytes(totalBytes);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* -90° puts the arc origin at 12 o'clock. */}
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.color.track}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {arcs.map(arc => (
            <Circle
              key={arc.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={arc.offset}
              fill="none"
            />
          ))}
        </G>
      </Svg>

      <View style={styles.center} pointerEvents="none">
        <Text variant="display">{formatted.value}</Text>
        <Text variant="caption" color="accent" uppercase style={styles.caption}>
          {`${formatted.unit} ${caption}`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { marginTop: 2 },
});
