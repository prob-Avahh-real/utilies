// React Native mobile entry point for shake detection
// To use, install react-native-sensors:
//   npm install react-native-sensors@^7.3.0
// (or use expo-sensors for Expo projects)

import ShakeDetector from '../shared/shakeDetector';
import { accelerometer, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';

const detector = new ShakeDetector(() => console.log('shook'));
setUpdateIntervalForType(SensorTypes.accelerometer, 100);

const sub = accelerometer.subscribe(({ x, y, z }) => {
  detector.handleMotion({ x, y, z });
});

// Remember to unsubscribe when component unmounts:
//   sub.unsubscribe();
