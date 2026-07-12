const detector = new ShakeDetector(
  () => {
    count++;
    document.getElementById('status').textContent = 'SHAKE!';
    document.getElementById('count').textContent = `Shakes: ${count}`;
    setTimeout(() => {
      document.getElementById('status').textContent = 'Listening for shake...';
    }, 500);
  },
  { threshold: 400, interval: 100 }
);

let count = 0;

if (window.DeviceMotionEvent) {
  window.addEventListener('devicemotion', (event) => {
    const { x, y, z } = event.accelerationIncludingGravity || {};
    if (x != null) detector.handleMotion({ x, y, z });
  });
} else {
  document.getElementById('status').textContent =
    'DeviceMotion not supported on this browser.';
}
