import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, Pressable as NativePressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

export const colors = { ink: '#183E40', muted: '#57706E', teal: '#087E80', deep: '#103F40', mint: '#DDF1E9', lime: '#DDF2AB', paper: '#F7F8F2', line: '#DCE6DF', peach: '#F9E9DA', error: '#AD3E4A' };
export const fonts = { body: 'Manrope_400Regular', medium: 'Manrope_500Medium', bold: 'Manrope_700Bold', display: 'Lora_500Medium' };
const MotionContext = createContext(true);
export const useReducedMotion = () => useContext(MotionContext);

export function MotionProvider({ children }) {
  const [reduced, setReduced] = useState(() => Platform.OS === 'web' ? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? true : true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const media = Platform.OS === 'web' ? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
    const changed = event => setReduced(event.matches);
    media?.addEventListener?.('change', changed);
    return () => { active = false; subscription.remove(); media?.removeEventListener?.('change', changed); };
  }, []);
  return <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>;
}

const AnimatedPressable = Animated.createAnimatedComponent(NativePressable);
export function Pressable({ style, onPressIn, onPressOut, accessibilityRole = 'button', ...props }) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const animate = value => {
    scale.stopAnimation();
    Animated.timing(scale, { toValue: value, duration: reduced ? 0 : 140, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  return <AnimatedPressable {...props} accessibilityRole={accessibilityRole} onPressIn={event => { setPressed(true); animate(0.96); onPressIn?.(event); }} onPressOut={event => { setPressed(false); animate(1); onPressOut?.(event); }} style={[typeof style === 'function' ? style({ pressed }) : style, { transform: [{ scale }] }]} />;
}
export function feedback() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}
export function successFeedback() {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function Reveal({ children, delay = 0, style }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, delay: reduced ? 0 : delay, duration: reduced ? 100 : 300, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress, delay, reduced]);
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: reduced ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>{children}</Animated.View>;
}

export function CountValue({ value, style }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    const numeric = typeof value === 'number' && Number.isFinite(value);
    if (reduced || !numeric) { setDisplay(value); previous.current = value; return undefined; }
    const start = typeof previous.current === 'number' ? previous.current : value;
    const animated = new Animated.Value(start);
    const decimals = Number.isInteger(value) ? 0 : 1;
    const listener = animated.addListener(({ value: current }) => setDisplay(Number(current.toFixed(decimals))));
    const animation = Animated.timing(animated, { toValue: value, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(() => setDisplay(value));
    previous.current = value;
    return () => { animation.stop(); animated.removeListener(listener); };
  }, [value, reduced]);
  return <Text style={style} accessibilityLabel={String(value)}>{display}</Text>;
}

export function LetterGreeting({ text, style }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: reduced ? 100 : 650, easing: Easing.out(Easing.quad), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  return <Text style={style} accessibilityLabel={text}>{Array.from(text).map((letter, index) => <Animated.Text key={index} accessible={false} style={{ opacity: reduced ? progress : progress.interpolate({ inputRange: [index / (text.length + 2), (index + 2) / (text.length + 2)], outputRange: [0, 1], extrapolate: 'clamp' }) }}>{letter}</Animated.Text>)}</Text>;
}

export function Skeleton() {
  const reduced = useReducedMotion();
  const shimmer = useRef(new Animated.Value(.45)).current;
  useEffect(() => {
    let animation;
    const update = state => {
      animation?.stop();
      if (reduced || state !== 'active') { shimmer.setValue(.65); return; }
      animation = Animated.loop(Animated.sequence([Animated.timing(shimmer, { toValue: .9, duration: 750, useNativeDriver: true }), Animated.timing(shimmer, { toValue: .45, duration: 750, useNativeDriver: true })]));
      animation.start();
    };
    update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => { animation?.stop(); subscription.remove(); };
  }, [reduced, shimmer]);
  return <Animated.View accessibilityLabel="Đang tải dữ liệu sức khỏe" style={{ opacity: shimmer, padding: 20, borderRadius: 24, backgroundColor: '#FFFFFF', marginBottom: 16, marginTop: 18 }}><View style={{ height: 18, width: '55%', backgroundColor: '#DBE6D4', borderRadius: 8, marginBottom: 16 }} /><View style={{ flexDirection: 'row', gap: 12 }}>{[0, 1].map(i => <View key={i} style={{ flex: 1, height: 105, borderRadius: 16, backgroundColor: '#E8EEE2' }} />)}</View></Animated.View>;
}

const iconPaths = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9v11h5v-6h3v6h5V9',
  health: 'M12 4v16M4 12h16',
  care: 'M20.8 5.5c-2.1-2.3-5.7-1.4-8.8 1.6C8.9 4.1 5.3 3.2 3.2 5.5-.5 9.7 6.3 16.7 12 21c5.7-4.3 12.5-11.3 8.8-15.5Z',
  appointments: 'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 3v5m10-5v5M3 10h18M7 14h2m3 0h2m3 0h1M7 17h2m3 0h2',
  profile: 'M7 7a5 5 0 1 0 10 0A5 5 0 0 0 7 7Zm-4 15v-2a9 9 0 0 1 18 0v2',
  message: 'M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0ZM7 11h10m-10 4h6',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  back: 'M19 12H5m6-6-6 6 6 6',
  spark: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z',
  check: 'm5 12 4 4L20 5',
  pulse: 'M2 12h5l3-8 4 16 3-8h5',
  drop: 'M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13Z',
  scale: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4a7 7 0 0 1 10 0l-5 5Zm5-3v4',
  clock: 'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0Zm-9-5v6l4 2',
  shield: 'm12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5Zm-4 9 3 3 5-6',
  meal: 'M6 2v7m-3-7v5a3 3 0 0 0 6 0V2M6 10v12M18 2c-4 3-4 8 0 10V2Zm0 10v10',
  walk: 'M15 4h.1M11 10l3-3 4 4h3M14 8l-3 7-5 6m6-8 5 3 1 6M4 12l4-2',
  medicine: 'm8 3 13 13a5 5 0 0 1-7 7L1 10a5 5 0 0 1 7-7Zm-3 12 7-7',
};
export function Icon({ name = 'spark', size = 24, color = colors.teal, strokeWidth = 1.7 }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}><Path d={iconPaths[name] || iconPaths.spark} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

// Original vector artwork: gradients and a few paths give depth without a 3D engine.
export function HealthArt({ robot = false, size = 160 }) {
  return <Svg width={size} height={size} viewBox="0 0 200 200" accessible={false}>
    <Defs><LinearGradient id="mint" x1="0" y1="0" x2="1" y2="1"><Stop stopColor="#EFFBD8" /><Stop offset=".48" stopColor="#BCEACD" /><Stop offset="1" stopColor="#53ABA0" /></LinearGradient><LinearGradient id="ceramic" x1="0" y1="0" x2=".8" y2="1"><Stop stopColor="#FFFFFF" /><Stop offset=".65" stopColor="#E3F1E9" /><Stop offset="1" stopColor="#82BCAB" /></LinearGradient><LinearGradient id="heart" x1="0" y1="0" x2="1" y2="1"><Stop stopColor="#F9BDA9" /><Stop offset=".5" stopColor="#E88F7D" /><Stop offset="1" stopColor="#AD5A61" /></LinearGradient></Defs>
    <Circle cx="101" cy="95" r="78" fill="none" stroke="#DBEDCF" strokeOpacity=".3" />
    <Circle cx="101" cy="95" r="64" fill="none" stroke="#DBEDCF" strokeOpacity=".2" />
    {Array.from({ length: 16 }, (_, i) => <Path key={i} d="M101 9v8" stroke="#E2F3C4" strokeOpacity=".5" strokeWidth="2" transform={`rotate(${i * 22.5} 101 95)`} />)}
    <Ellipse cx="104" cy="168" rx="52" ry="10" fill="#052C2F" opacity=".18" />
    {robot ? <G transform="rotate(-8 100 100)"><Rect x="48" y="55" width="108" height="94" rx="34" fill="url(#ceramic)" /><Rect x="60" y="72" width="84" height="54" rx="22" fill="#174F50" /><Circle cx="84" cy="96" r="5" fill="#DDF2AB" /><Circle cx="120" cy="96" r="5" fill="#DDF2AB" /><Path d="M94 111q8 7 16-1" fill="none" stroke="#DDF2AB" strokeWidth="3" strokeLinecap="round" /><Path d="M102 55V41" stroke="#BCEACD" strokeWidth="7" /><Circle cx="102" cy="37" r="7" fill="#DDF2AB" /><Rect x="36" y="89" width="12" height="28" rx="6" fill="#81B4A8" /><Rect x="156" y="89" width="12" height="28" rx="6" fill="#81B4A8" /><Path d="M66 63q32-11 65 0" stroke="#FFF" opacity=".8" strokeWidth="3" fill="none" /></G> : <G transform="rotate(-12 100 100)"><Rect x="44" y="52" width="114" height="108" rx="34" fill="url(#mint)" /><Rect x="53" y="54" width="97" height="95" rx="29" fill="url(#ceramic)" /><Path d="M100 124C42 91 77 63 100 88c23-25 58 3 0 36Z" fill="url(#heart)" /><Path d="m71 104 17 0 7-12 8 22 7-12h19" fill="none" stroke="#FFF9EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><Path d="M66 63q28-10 64-2" stroke="#FFF" opacity=".9" strokeWidth="3" fill="none" /></G>}
    <Circle cx="163" cy="49" r="8" fill="#DDF2AB" /><Circle cx="33" cy="136" r="4" fill="#F1BAA6" />
    <Path d="m35 47 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#DDF2AB" />
  </Svg>;
}

export function AmbientArt({ robot = false, size = 160 }) {
  const reduced = useReducedMotion();
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let animation;
    const update = state => {
      animation?.stop();
      if (!reduced && state === 'active') {
        animation = Animated.loop(Animated.sequence([Animated.timing(drift, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(drift, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true })]));
        animation.start();
      } else drift.setValue(0);
    };
    update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => { animation?.stop(); subscription.remove(); };
  }, [reduced, drift]);
  return <Animated.View style={{ transform: [{ translateY: reduced ? 0 : drift.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }}><HealthArt robot={robot} size={size} /></Animated.View>;
}

export function Intro({ onDone }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, delay: reduced ? 0 : 450, duration: reduced ? 100 : 600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) onDone(); });
    return () => animation.stop();
  }, [onDone, progress, reduced]);
  return <View style={intro.overlay}>
    {[-1, 1].map(direction => <Animated.View key={direction} style={[intro.curtain, { left: direction < 0 ? 0 : '50%', opacity: reduced ? progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : 1, transform: [{ translateX: reduced ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [0, direction * 650] }) }] }]} />)}
    <Animated.View style={{ alignItems: 'center', opacity: progress.interpolate({ inputRange: [0, .6, 1], outputRange: [1, 1, 0] }) }}><HealthArt size={170} /><Text style={intro.brand}>DOCTIS</Text><Text style={intro.caption}>Một nhịp chăm sóc. Mỗi ngày.</Text></Animated.View>
    <NativePressable accessibilityRole="button" accessibilityLabel="Bỏ qua giới thiệu" onPress={onDone} style={intro.skip}><Text style={intro.skipText}>Bỏ qua →</Text></NativePressable>
  </View>;
}
const intro = StyleSheet.create({ overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, alignItems: 'center', justifyContent: 'center' }, curtain: { position: 'absolute', top: 0, bottom: 0, width: '50%', backgroundColor: colors.deep }, brand: { fontFamily: fonts.bold, color: '#F7F8F2', fontSize: 32, letterSpacing: 5 }, caption: { fontFamily: fonts.body, color: '#DDF2AB', fontSize: 14, marginTop: 14 }, skip: { position: 'absolute', bottom: 44, padding: 16, minHeight: 48 }, skipText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' } });
