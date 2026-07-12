import { Accelerometer } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { isShake } from '../utils/shakeDetector';

export function ShakeListener() {
  const [shaken, setShaken] = useState(false);
  const prevRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    const sub = Accelerometer.addListener((data) => {
      if (isShake(prevRef.current, data)) {
        setShaken(true);
      }
      prevRef.current = data;
    });
    return () => sub.remove();
  }, []);

  return <Text>{shaken ? 'Shaken!' : 'Waiting...'}</Text>;
}
