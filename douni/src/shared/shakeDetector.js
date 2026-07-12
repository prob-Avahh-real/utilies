class ShakeDetector {
  constructor(onShake, options = {}) {
    this.threshold = options.threshold || 400;
    this.interval = options.interval || 100;
    this.listeners = [];
    if (onShake) this.listeners.push(onShake);
    this.lastTime = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.lastZ = 0;
  }

  onShake(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  handleMotion({ x, y, z }) {
    const now = Date.now();
    if (now - this.lastTime < this.interval) return;

    const deltaX = Math.abs(x - this.lastX);
    const deltaY = Math.abs(y - this.lastY);
    const deltaZ = Math.abs(z - this.lastZ);

    const total = deltaX + deltaY + deltaZ;
    if (total > this.threshold) {
      this.lastTime = now;
      this.listeners.forEach((cb) => cb({ x, y, z, total }));
    }

    this.lastX = x;
    this.lastY = y;
    this.lastZ = z;
  }

  reset() {
    this.listeners = [];
    this.lastTime = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.lastZ = 0;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShakeDetector;
}
