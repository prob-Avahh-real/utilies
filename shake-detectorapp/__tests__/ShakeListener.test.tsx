import React from 'react';
import { render, act } from '@testing-library/react-native';
import { ShakeListener } from '../components/ShakeListener';

// mock expo-sensors
jest.mock('expo-sensors', () => {
  let listener: (data: any) => void;
  return {
    Accelerometer: {
      addListener: (cb: (data: any) => void) => {
        listener = cb;
        return { remove: () => {} };
      },
      // helper to trigger
      __trigger: (data: any) => listener && listener(data),
    },
  };
});

describe('ShakeListener component', () => {
  it('shows "Waiting..." initially and updates when shake detected', () => {
    const { getByText } = render(<ShakeListener />);
    expect(getByText('Waiting...')).toBeTruthy();

    // simulate accelerometer events
    act(() => {
      // first event small movement
      (require('expo-sensors').Accelerometer as any).__trigger({ x: 0, y: 0, z: 0 });
      // large event triggers shake
      (require('expo-sensors').Accelerometer as any).__trigger({ x: 0, y: 0, z: 5 });
    });

    expect(getByText('Shaken!')).toBeTruthy();
  });
});

// test
