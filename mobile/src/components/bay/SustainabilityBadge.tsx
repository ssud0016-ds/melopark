import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { BayCarbon } from '../../services/apiBays';

const BASELINE_G = 387;

type Props = { carbonData: BayCarbon | null };

type Tier = 'high' | 'mid' | 'low';
type Palette = { bg: string; border: string; txt: string; sub: string; lbl: string };

const TIER: Record<Tier, Palette> = {
  high: { bg: '#EAF3DE', border: '#3B6D11', txt: '#27500A', sub: '#4D7C1A', lbl: 'Efficient' },
  mid:  { bg: '#FAEEDA', border: '#BA7517', txt: '#633806', sub: '#8A5210', lbl: 'Moderate' },
  low:  { bg: '#F1EFE8', border: '#888780', txt: '#444441', sub: '#6B6A65', lbl: 'Low saving' },
};

function useCountUp(target: number, duration = 1000): number {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  const t0 = useRef<number | null>(null);
  useEffect(() => {
    if (target == null) return;
    if (raf.current != null) cancelAnimationFrame(raf.current);
    t0.current = null;
    const run = (ts: number) => {
      if (t0.current == null) t0.current = ts;
      const p = Math.min((ts - t0.current) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf.current = requestAnimationFrame(run);
    };
    raf.current = requestAnimationFrame(run);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);
  return val;
}

function Ring({
  pct,
  color,
  trackColor,
  size = 68,
  strokeWidth = 6,
  children,
}: {
  pct: number;
  color: string;
  trackColor: string;
  size?: number;
  strokeWidth?: number;
  children: React.ReactNode;
}) {
  const r = size / 2 - strokeWidth;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(Math.max(pct, 0), 100) / 100) * circ;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} strokeLinecap="round" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`}
          strokeDashoffset={(circ / 4).toFixed(1)}
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}

export function SustainabilityBadge({ carbonData }: Props) {
  const savedG = carbonData?.saved_g ?? 0;
  const pctAvoided = carbonData?.pct_avoided ?? 0;
  const score = carbonData?.score ?? 0;

  const animG = useCountUp(savedG, 1000);
  const animPct = useCountUp(Math.round(pctAvoided * 100), 1200);
  const animScore = useCountUp(score, 800);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: false, easing: Easing.out(Easing.ease) }),
        Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: false, easing: Easing.in(Easing.ease) }),
        Animated.delay(3800),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  if (!carbonData) return null;

  const tier: Tier = score >= 65 ? 'high' : score >= 35 ? 'mid' : 'low';
  const C = TIER[tier];
  const co2Pct = Math.round((savedG / BASELINE_G) * 100);

  const shadowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] });

  const footer =
    score >= 65
      ? `You avoided ${Math.round(pctAvoided * 100)}% of typical Melbourne CBD cruising — great sustainability choice.`
      : score >= 35
        ? `You skipped ${Math.round(pctAvoided * 100)}% of the typical 2.0 km Melbourne CBD search drive.`
        : `MeloPark helped you find this bay, saving ${savedG}g of search emissions.`;

  return (
    <Animated.View
      accessibilityLabel={`${Math.round(pctAvoided * 100)}% of Melbourne CBD cruising avoided, ${savedG}g CO2 saved, carbon score ${score} out of 100`}
      style={{
        borderRadius: 16,
        marginTop: 12,
        backgroundColor: C.bg,
        borderWidth: 1.5,
        borderColor: `${C.border}33`,
        padding: 14,
        shadowColor: C.border,
        shadowOpacity,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 17 }}>🌿</Text>
          <Text style={{ fontSize: 13, fontWeight: '500', color: C.txt }}>CO₂ saved by parking smart</Text>
        </View>
        <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, backgroundColor: `${C.border}22` }}>
          <Text style={{ fontSize: 11, fontWeight: '500', color: C.txt }}>{C.lbl}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Ring pct={co2Pct} color="#3B6D11" trackColor="#C0DD97">
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#27500A' }}>{animG}</Text>
            <Text style={{ fontSize: 9, color: '#3B6D11' }}>g</Text>
          </Ring>
          <Text style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>CO₂ saved</Text>
          <Text style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>of 387g baseline</Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Ring pct={animPct} color="#0F6E56" trackColor="#9FE1CB">
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#085041' }}>{animPct}</Text>
            <Text style={{ fontSize: 9, color: '#0F6E56' }}>%</Text>
          </Ring>
          <Text style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>cruise avoided</Text>
          <Text style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>of 2.0 km</Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Ring pct={animScore} color={C.border} trackColor={`${C.border}33`}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: C.txt }}>{animScore}</Text>
            <Text style={{ fontSize: 9, color: C.sub }}>/100</Text>
          </Ring>
          <Text style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>carbon score</Text>
          <Text style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>live street data</Text>
        </View>
      </View>

      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: `${C.border}33` }}>
        <Text style={{ fontSize: 11, lineHeight: 17, color: C.sub }}>{footer}</Text>
      </View>
    </Animated.View>
  );
}
