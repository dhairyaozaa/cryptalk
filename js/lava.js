/**
 * CrypTalk Lava Lamp Engine
 * Metaball simulation with WebGL-style canvas rendering
 * Organic blob physics with color cycling
 */

const LavaLamp = (() => {
  let canvas, ctx, W, H, animFrame;
  let blobs = [];
  let time = 0;

  const PALETTE = [
    { r: 74,  g: 158, b: 255 },  // electric blue
    { r: 139, g: 92,  b: 246 },  // violet
    { r: 6,   g: 255, b: 165 },  // mint
    { r: 255, g: 74,  b: 180 },  // pink
    { r: 74,  g: 200, b: 255 },  // cyan
    { r: 180, g: 80,  b: 255 },  // purple
  ];

  class Blob {
    constructor(index) {
      this.index = index;
      this.reset();
    }

    reset() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.r = 80 + Math.random() * 140;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = (Math.random() - 0.5) * 0.6;
      this.colorIndex = this.index % PALETTE.length;
      this.nextColorIndex = (this.colorIndex + 1) % PALETTE.length;
      this.colorT = 0;
      this.colorSpeed = 0.002 + Math.random() * 0.003;
      this.pulsePhase = Math.random() * Math.PI * 2;
      this.pulseSpeed = 0.008 + Math.random() * 0.012;
      this.pulseAmp = 0.12 + Math.random() * 0.15;

      // Lava lamp vertical drift
      this.rising = Math.random() > 0.5;
      this.driftSpeed = 0.15 + Math.random() * 0.25;
      this.driftTimer = 0;
      this.driftPeriod = 300 + Math.random() * 400;
    }

    get color() {
      const a = PALETTE[this.colorIndex];
      const b = PALETTE[this.nextColorIndex];
      const t = this.colorT;
      return {
        r: Math.round(a.r + (b.r - a.r) * t),
        g: Math.round(a.g + (b.g - a.g) * t),
        b: Math.round(a.b + (b.b - a.b) * t)
      };
    }

    get currentRadius() {
      return this.r * (1 + Math.sin(time * this.pulseSpeed + this.pulsePhase) * this.pulseAmp);
    }

    update() {
      // Color cycling
      this.colorT += this.colorSpeed;
      if (this.colorT >= 1) {
        this.colorT = 0;
        this.colorIndex = this.nextColorIndex;
        this.nextColorIndex = (this.nextColorIndex + 1) % PALETTE.length;
      }

      // Lava lamp drift
      this.driftTimer++;
      if (this.driftTimer > this.driftPeriod) {
        this.rising = !this.rising;
        this.driftTimer = 0;
        this.driftPeriod = 300 + Math.random() * 400;
      }

      const drift = this.rising ? -this.driftSpeed : this.driftSpeed;

      this.x += this.vx;
      this.y += this.vy + drift;

      // Boundary bounce with softness
      const pad = this.r;
      if (this.x < -pad) this.x = W + pad;
      if (this.x > W + pad) this.x = -pad;
      if (this.y < -pad) this.y = H + pad;
      if (this.y > H + pad) this.y = -pad;

      // Gentle random walk
      this.vx += (Math.random() - 0.5) * 0.04;
      this.vy += (Math.random() - 0.5) * 0.04;
      this.vx *= 0.97;
      this.vy *= 0.97;
    }
  }

  function init() {
    canvas = document.getElementById('lava-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    const count = Math.min(12, Math.floor((W * H) / 60000) + 6);
    blobs = Array.from({ length: count }, (_, i) => new Blob(i));

    animate();
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    if (blobs.length) blobs.forEach(b => b.reset());
  }

  function drawBlobs() {
    // Clear with deep dark bg
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, W, H);

    // Draw each blob as a radial gradient (metaball approximation)
    ctx.globalCompositeOperation = 'screen';

    for (const blob of blobs) {
      const { r, g, b } = blob.color;
      const radius = blob.currentRadius;
      const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, radius);

      grad.addColorStop(0,   `rgba(${r}, ${g}, ${b}, 0.28)`);
      grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.16)`);
      grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.07)`);
      grad.addColorStop(1,   `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.arc(blob.x, blob.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Second pass — brighter core highlights
    ctx.globalCompositeOperation = 'lighter';
    for (const blob of blobs) {
      const { r, g, b } = blob.color;
      const radius = blob.currentRadius * 0.4;
      const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, radius);

      grad.addColorStop(0,   `rgba(${r}, ${g}, ${b}, 0.18)`);
      grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.06)`);
      grad.addColorStop(1,   `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.arc(blob.x, blob.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';

    // Dark vignette overlay for depth
    const vignette = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.9);
    vignette.addColorStop(0, 'rgba(5,8,16,0)');
    vignette.addColorStop(1, 'rgba(5,8,16,0.75)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    // Subtle noise grain overlay
    drawGrain();
  }

  function drawGrain() {
    // Lightweight scanline effect for depth
    ctx.globalAlpha = 0.025;
    ctx.globalCompositeOperation = 'overlay';
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`;
      ctx.fillRect(0, y, W, 1);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function animate() {
    time++;
    blobs.forEach(b => b.update());
    drawBlobs();
    animFrame = requestAnimationFrame(animate);
  }

  function stop() {
    if (animFrame) cancelAnimationFrame(animFrame);
  }

  return { init, stop };
})();

window.LavaLamp = LavaLamp;
