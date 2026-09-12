import { useEffect, useRef } from 'react';

// Ported from a Framer component (see PR/commit notes) - the animation
// logic below is unchanged from the reference. What's gone is everything
// that only exists inside the Framer editor:
//   - `addPropertyControls`/`ControlType`/`RenderTarget` imports and the
//     addPropertyControls(...) call, which just wire up Framer's property
//     panel and don't exist as a package here.
//   - The `stopInEditor`/`RenderTarget.current()` check - there's no
//     editor context to be "in", so the animation always just runs.
// Everything else (canvas setup, star field math, resize/mouse handling,
// the rAF loop and its cleanup) is the same code.
export default function Starfield({
  stars = 600,
  speed = 2,
  spread = 5,
  focal = 1,
  twinkle = 0.35,
  trail = 0.75,
  size = 2,
  fadeInRange = 5,
  reverseFly = true,
  followCursor = false,
  background = '#000000',
  starColor = '#ffffff',
}) {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const starsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // Cap DPR so a 3x/4x-DPI phone or monitor doesn't quietly triple the
    // number of pixels this has to fill every frame - 2x is already
    // sharp enough for a field of small dots.
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    const createStar = () => ({
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread,
      z: Math.random(),
      tw: Math.random() * Math.PI * 2,
    });

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * DPR;
      canvas.height = rect.height * DPR;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    starsRef.current = Array.from({ length: stars }, createStar);

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current.x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      mouse.current.y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    };
    window.addEventListener('mousemove', onMouseMove);

    let raf = 0;
    const animate = () => {
      const w = canvas.width / DPR;
      const h = canvas.height / DPR;

      ctx.globalAlpha = 1;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      if (trail < 1) {
        ctx.globalAlpha = 1 - trail;
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalAlpha = 1;
      ctx.fillStyle = starColor;
      const cx = followCursor ? mouse.current.x * w : w / 2;
      const cy = followCursor ? mouse.current.y * h : h / 2;

      for (const s of starsRef.current) {
        const depth = s.z * clamp(focal, 0.01, 10) + 0.001;
        const px = cx + (s.x / depth) * w;
        const py = cy + (s.y / depth) * h;

        s.z += reverseFly ? clamp(speed, 0, 10) * 0.002 : -clamp(speed, 0, 10) * 0.002;
        if (s.z <= 0 || s.z > 1) Object.assign(s, createStar());

        s.tw += clamp(twinkle, 0, 1) * 0.05;
        const alpha = Math.max(0, 1 - s.z / clamp(fadeInRange, 0.1, 10));
        const radius = clamp(size, 0.1, 5) * (1 - s.z) * (1 + Math.sin(s.tw) * clamp(twinkle, 0, 1));

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [stars, speed, spread, focal, twinkle, trail, size, fadeInRange, reverseFly, followCursor, background, starColor]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', background }} />;
}
