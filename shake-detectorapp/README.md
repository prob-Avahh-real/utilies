# Shake Detector App

Cross-platform shake detection application built with **Expo SDK 54** and **React Native**. Detects device shake via accelerometer and provides visual/haptic feedback.

Targets **iOS + Android + Web** from a single codebase with file-based routing.

## Architecture

```
shake-detectorapp/
├── app/                    # Expo Router pages (file-based routing)
│   ├── (tabs)/             # Tab layout (home + explore)
│   │   ├── _layout.tsx     # Bottom tab navigator config
│   │   ├── index.tsx       # Home screen
│   │   └── explore.tsx     # Explore / debug screen
│   ├── _layout.tsx         # Root layout
│   └── modal.tsx           # Modal route
├── components/
│   ├── ShakeListener.tsx   # Shake detection component (expo-sensors)
│   ├── haptic-tab.tsx      # Haptic feedback tab bar
│   ├── themed-text.tsx     # Light/dark themed text
│   ├── themed-view.tsx     # Light/dark themed container
│   └── ui/                 # Reusable UI primitives
├── utils/
│   └── shakeDetector.ts    # Core shake detection algorithm
├── hooks/                  # Theme & color-scheme hooks
├── constants/              # Theme tokens
└── __tests__/              # Jest unit tests for shakeDetector + ShakeListener
```

## Core Shake Detection

The detection algorithm lives in `utils/shakeDetector.ts`. It computes the magnitude of the acceleration vector and compares the difference between consecutive readings against a configurable threshold.

```ts
import { isShake, magnitude } from '@/utils/shakeDetector';

// magnitude({ x: 3, y: 4, z: 0 }) → 5.0
// isShake(prev, curr, 2.0) → true if diff >= 2.0
```

The `ShakeListener` component wraps `expo-sensors`' `Accelerometer` API, subscribing to device motion and firing callbacks when a shake is detected:

```tsx
import { ShakeListener } from '@/components/ShakeListener';
// Renders "Waiting..." normally, "Shaken!" on shake
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the app

```bash
npx expo start
```

In the output you'll see options to open in:

- **Expo Go** (iOS/Android) — scan QR code, no build required
- **iOS Simulator** — press `i`
- **Android Emulator** — press `a`
- **Web browser** — press `w`

### 3. Running tests

```bash
npm test
```

Jest tests cover:
- `shakeDetector.isShake()` — threshold logic with various acceleration deltas
- `shakeDetector.magnitude()` — vector length computation
- `ShakeListener` component — renders initial state, transitions on simulated shake event

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54 + React Native 0.81 |
| Language | TypeScript 5.9 |
| Routing | Expo Router v6 (file-based, typed routes) |
| Navigation | React Navigation 7 (bottom tabs) |
| Sensors | expo-sensors (Accelerometer) |
| Haptics | expo-haptics |
| Animation | react-native-reanimated 4 |
| Testing | Jest + @testing-library/react-native |
| Linting | ESLint 9 + eslint-config-expo |

## Platform Support

| Feature | iOS | Android | Web |
|---|---|---|---|
| Shake detection | ✅ | ✅ | ✅ |
| Haptic feedback | ✅ | ✅ | — |
| Dark mode | ✅ | ✅ | ✅ |
| File-based routing | ✅ | ✅ | ✅ |

## Extending

- **Threshold tuning** — adjust the `threshold` parameter in `isShake()` call inside `ShakeListener.tsx`
- **Haptic pattern** — customize haptic feedback strength in `haptic-tab.tsx`
- **New screens** — add files under `app/`; Expo Router picks them up automatically
- **Additional sensors** — `expo-sensors` also provides Gyroscope, Magnetometer, Pedometer, etc.

## License

MIT
