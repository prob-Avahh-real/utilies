# Cross-Platform Shake Detection App

This repository contains a modular skeleton for a shake detection application targeting web, mobile (React Native), and desktop (Electron) platforms.

## Structure

- `src/web` – Web frontend using HTML/CSS/JS.
- `src/mobile` – Placeholder for React Native implementation.
- `src/desktop` – Placeholder for Electron implementation.
- `src/shared` – Shared shake detection logic, importable from any platform.

## Getting Started

### Shared Logic

Common shake detection code lives in `src/shared/shakeDetector.js`. Import this module from any platform-specific code to keep behavior consistent. The class supports multiple listeners, configurable `threshold` and `interval`, and a `reset()` method.

Usage example:
```js
const detector = new ShakeDetector(() => { /* primary callback */ }, {threshold:400});
detector.onShake(() => console.log('another listener'));
// call detector.handleMotion({x,y,z}) when accelerometer data arrives
```

### Web

Open `src/web/index.html` in a browser (preferably on a device with accelerometer support) to run the demo.

### Mobile

The `src/mobile` directory currently holds a minimal `package.json` and `index.js` that show how to import the shared detector. To initialize a full React Native project here run:

```bash
cd src/mobile
npx react-native init ShakeApp --directory .
```

Alternatively, use Expo (`expo init`) for a lighter setup. After setup, install a sensor library such as `react-native-sensors` or `expo-sensors` and forward acceleration data to `detector.handleMotion({x,y,z})`.

The provided `index.js` stub includes an example using `react-native-sensors`:

```bash
npm install react-native-sensors@^7.3.0
# (or use expo-sensors for Expo projects)
```

```js
import ShakeDetector from '../shared/shakeDetector';
import { accelerometer, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';

const detector = new ShakeDetector(() => console.log('shook'));
setUpdateIntervalForType(SensorTypes.accelerometer, 100);
const sub = accelerometer.subscribe(({x,y,z}) => {
  detector.handleMotion({x,y,z});
});

// remember to unsubscribe when component unmounts
```

### Desktop

A basic Electron scaffold is already present. Dependencies have been installed. Start the app with:

```bash
cd src/desktop
npm run start
```

Because desktop machines usually lack accelerometers, the current implementation simply displays a placeholder message. To extend it you would:

1. Integrate a native addon or USB sensor module to capture motion data.
2. In the renderer process call `detector.handleMotion(...)` with readings.

## Testing the Shared Detector

A simple Node script is provided at `src/shared/test-shake.js` which simulates motion input. Run it with:

```bash
node src/shared/test-shake.js
```

It will log messages when the detector fires and demonstrates the multiple-listener API.

## Extending

The common shake detection logic lives in a shared module that can be imported by each platform. Add new platforms by creating a new directory under `src/` that imports from `src/shared/`.

## License

MIT
