const ShakeDetector = require('./shakeDetector');

const detector = new ShakeDetector(
  (data) => console.log(`SHAKE! total=${data.total.toFixed(0)}`),
  { threshold: 400, interval: 50 }
);

// Simulate accelerometer data
const steps = [
  { x: 0, y: 0, z: 0 },
  { x: 50, y: 20, z: 400 },
  { x: 20, y: -10, z: -200 },
  { x: 0, y: 0, z: 0 },
  { x: 100, y: 100, z: 600 },
  { x: -80, y: 30, z: -500 },
];

let i = 0;
const interval = setInterval(() => {
  if (i >= steps.length) {
    clearInterval(interval);
    console.log('Test complete.');
    return;
  }
  detector.handleMotion(steps[i]);
  i++;
}, 200);
