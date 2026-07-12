import { isShake, magnitude } from '../utils/shakeDetector';

describe('shakeDetector', () => {
  test('magnitude computes vector length', () => {
    expect(magnitude({ x: 3, y: 4, z: 0 })).toBeCloseTo(5);
  });

  test('isShake returns true when change exceeds threshold', () => {
    const prev = { x: 0, y: 0, z: 1 };
    const curr = { x: 0, y: 0, z: 5 };
    expect(isShake(prev, curr, 3.0)).toBe(true);
  });

  test('isShake returns false when change below threshold', () => {
    const prev = { x: 0, y: 0, z: 1 };
    const curr = { x: 0, y: 0, z: 2 };
    expect(isShake(prev, curr, 3.0)).toBe(false);
  });
});
