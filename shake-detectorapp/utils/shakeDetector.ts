export type Accel = { x: number; y: number; z: number };

// Simple shake detection: difference in magnitude
export function magnitude(a: Accel) {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

export function isShake(prev: Accel, curr: Accel, threshold = 2.0) {
  const diff = Math.abs(magnitude(curr) - magnitude(prev));
  return diff >= threshold;
}

export default { magnitude, isShake };
