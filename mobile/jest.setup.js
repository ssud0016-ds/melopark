// Mock Reanimated + Worklets for unit tests (no native runtime in jest).

jest.mock('react-native-worklets', () => ({
  runOnUI: (fn) => fn,
  runOnJS: (fn) => fn,
  createWorkletRuntime: () => ({}),
  isWorkletFunction: () => false,
}));

jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: { View, ScrollView: View, Text: View, Image: View, createAnimatedComponent: (c) => c },
    View,
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (cb) => {
      try {
        return cb();
      } catch {
        return {};
      }
    },
    withTiming: (toValue) => toValue,
    withRepeat: (val) => val,
    withSpring: (toValue) => toValue,
    cancelAnimation: () => {},
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    Easing: { linear: jest.fn(), inOut: jest.fn(), ease: jest.fn() },
  };
});
