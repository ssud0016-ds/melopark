import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import type { WarningLevel } from '../../../services/apiForecasts';
import { useDarkMode } from '../../../hooks/useDarkMode';
import {
  ARC_END,
  ARC_SPAN,
  ARC_START,
  describeAnnularArc,
  polarXY,
} from './svgArc';
import { FORECAST_TIERS } from '../../../utils/forecastUtils';

const TICK_VALUES = [0, 25, 50, 75, 100] as const;

type Props = {
  pct: number;
  level: WarningLevel;
  width: number;
};

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function CbdPressureArc({ pct, level, width }: Props) {
  const { dark } = useDarkMode();
  const tier = FORECAST_TIERS[level] ?? FORECAST_TIERS.low;
  const gradId = useId().replace(/:/g, '');
  const clipId = useId().replace(/:/g, '');

  const H = Math.round(width * 0.58);
  const cx = width / 2;
  const cy = H * 0.92;
  const R = Math.min(width * 0.4, 110);
  const rIn = R - R * 0.13;

  const track = dark ? '#1e2a3a' : '#dde3f0';
  const tickMid = dark ? '#64748b' : '#94a3b8';
  const needleStroke = dark ? '#f1f5f9' : '#1e293b';
  const tc = dark ? '#f1f5f9' : '#0f172a';

  const trackPath = useMemo(
    () => describeAnnularArc(cx, cy, rIn, R, ARC_START, ARC_END),
    [cx, cy, rIn, R],
  );

  const fillEndAngle = ARC_START + (pct / 100) * ARC_SPAN;
  const clipPath = useMemo(
    () => describeAnnularArc(cx, cy, rIn - 2, R + 2, ARC_START, fillEndAngle),
    [cx, cy, rIn, R, fillEndAngle],
  );

  const [needleEnd, setNeedleEnd] = useState(() => {
    const l = rIn - 10;
    return { x: cx, y: cy - l };
  });
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    let t0: number | null = null;
    const l = rIn - 10;

    const go = (ts: number) => {
      if (t0 == null) t0 = ts;
      const p = Math.min((ts - t0) / 1300, 1);
      const e = easeOutCubic(p);
      const a = ARC_START + e * (pct / 100) * ARC_SPAN;
      setNeedleEnd({
        x: cx + l * Math.sin(a),
        y: cy - l * Math.cos(a),
      });
      if (p < 1) animRef.current = requestAnimationFrame(go);
    };

    animRef.current = requestAnimationFrame(go);
    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    };
  }, [pct, cx, cy, rIn]);

  return (
    <View style={{ width, height: H, alignItems: 'center' }}>
      <Svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#1D9E75" />
            <Stop offset="40%" stopColor="#7BBF50" />
            <Stop offset="65%" stopColor="#BA7517" />
            <Stop offset="100%" stopColor="#D85A30" />
          </LinearGradient>
          <ClipPath id={clipId}>
            <Path d={clipPath} />
          </ClipPath>
        </Defs>

        {/* Full track band (web d3.arc track) */}
        <Path d={trackPath} fill={track} />

        {/* Gradient fill clipped to occupancy wedge (web rect + clipPath) */}
        <G clipPath={`url(#${clipId})`}>
          <Rect
            x={cx - R - 4}
            y={cy - R - 4}
            width={(R + 4) * 2}
            height={(R + 4) * 2}
            fill={`url(#${gradId})`}
          />
        </G>

        {/* Tick marks 0 / 25 / 50 / 75 / 100 */}
        {TICK_VALUES.map((v) => {
          const a = ARC_START + (v / 100) * ARC_SPAN;
          const col = v === 0 ? '#1D9E75' : v === 100 ? '#D85A30' : tickMid;
          const inner = polarXY(cx, cy, rIn - 3, a);
          const outer = polarXY(cx, cy, R + 3, a);
          const label = polarXY(cx, cy, R + 14, a);
          return (
            <G key={v}>
              <Line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={col}
                strokeWidth={2}
              />
              <SvgText
                x={label.x}
                y={label.y}
                fontSize={8.5}
                fontWeight="600"
                fill={col}
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {`${v}%`}
              </SvgText>
            </G>
          );
        })}

        {/* Animated needle */}
        <Line
          x1={cx}
          y1={cy}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke={needleStroke}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Circle cx={cx} cy={cy} r={5.5} fill={needleStroke} />

        {/* Center labels */}
        <SvgText
          x={cx}
          y={cy - rIn * 0.44}
          fontSize={R * 0.31}
          fontWeight="700"
          fill={tc}
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          {`${pct}%`}
        </SvgText>
        <SvgText
          x={cx}
          y={cy - rIn * 0.44 + R * 0.23}
          fontSize={11}
          fontWeight="600"
          fill={tier.color}
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          {tier.label}
        </SvgText>
      </Svg>
    </View>
  );
}
