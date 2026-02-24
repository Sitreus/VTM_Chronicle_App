import { useEffect, useRef, useState } from "react";

// Themed particle palettes and behaviors per game type
const GAME_PARTICLES = {
  vtm: {
    colors: [[196, 30, 58], [140, 20, 40], [100, 10, 20], [180, 40, 50]],
    count: 35,
    create: (w, h, stagger) => ({
      // Blood drops drifting down
      x: Math.random() * w,
      y: stagger ? Math.random() * h : -20,
      size: 2 + Math.random() * 5,
      baseOpacity: 0.04 + Math.random() * 0.08,
      opacity: 0,
      vx: (Math.random() - 0.5) * 0.1,
      vy: 0.3 + Math.random() * 0.6,
      life: stagger ? Math.floor(Math.random() * 600) : 0,
      maxLife: 500 + Math.floor(Math.random() * 400),
      trail: 8 + Math.random() * 16,
    }),
    draw: (ctx, p, color) => {
      const [r, g, b] = color;
      // Trailing blood drop
      const grad = ctx.createLinearGradient(p.x, p.y - p.trail, p.x, p.y);
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},${p.opacity})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * 0.6, p.trail, 0, 0, Math.PI * 2);
      ctx.fill();
      // Drop head
      ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity * 1.5})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  mta: {
    colors: [[123, 47, 190], [155, 89, 182], [100, 60, 200], [180, 130, 255]],
    count: 25,
    create: (w, h, stagger) => ({
      // Arcane glyphs orbiting slowly
      x: Math.random() * w,
      y: Math.random() * h,
      size: 20 + Math.random() * 40,
      baseOpacity: 0.03 + Math.random() * 0.05,
      opacity: 0,
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      life: stagger ? Math.floor(Math.random() * 800) : 0,
      maxLife: 600 + Math.floor(Math.random() * 500),
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.008,
      glyphType: Math.floor(Math.random() * 4),
    }),
    draw: (ctx, p, color) => {
      const [r, g, b] = color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.strokeStyle = `rgba(${r},${g},${b},${p.opacity})`;
      ctx.lineWidth = 1;
      const s = p.size;
      // Draw different glyph shapes
      if (p.glyphType === 0) {
        ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.lineTo(s * 0.3, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(0, s * 0.3); ctx.stroke();
      } else if (p.glyphType === 1) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, s * (0.2 + i * 0.12), 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (p.glyphType === 2) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const method = i === 0 ? "moveTo" : "lineTo";
          ctx[method](Math.cos(a) * s * 0.35, Math.sin(a) * s * 0.35);
        }
        ctx.closePath(); ctx.stroke();
      } else {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const nextA = ((i * 2 + 2) % 5 / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.moveTo(Math.cos(a) * s * 0.35, Math.sin(a) * s * 0.35);
          ctx.lineTo(Math.cos(nextA) * s * 0.35, Math.sin(nextA) * s * 0.35);
        }
        ctx.stroke();
      }
      // Glow
      ctx.shadowColor = `rgba(${r},${g},${b},${p.opacity * 0.6})`;
      ctx.shadowBlur = 12;
      ctx.restore();
      p.rotation += p.rotSpeed;
    },
  },
  wta: {
    colors: [[74, 140, 63], [100, 160, 80], [60, 100, 45], [200, 120, 40]],
    count: 40,
    create: (w, h, stagger) => ({
      // Floating embers rising
      x: Math.random() * w,
      y: stagger ? Math.random() * h : h + 10,
      size: 1.5 + Math.random() * 3.5,
      baseOpacity: 0.06 + Math.random() * 0.1,
      opacity: 0,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.4 + Math.random() * 0.8),
      life: stagger ? Math.floor(Math.random() * 500) : 0,
      maxLife: 350 + Math.floor(Math.random() * 350),
      flicker: Math.random() * Math.PI * 2,
      flickerSpeed: 0.05 + Math.random() * 0.1,
    }),
    draw: (ctx, p, color) => {
      const [r, g, b] = color;
      const flicker = 0.5 + 0.5 * Math.sin(p.life * p.flickerSpeed + p.flicker);
      const op = p.opacity * flicker;
      // Ember glow
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
      grad.addColorStop(0, `rgba(${r},${g},${b},${op * 0.8})`);
      grad.addColorStop(0.3, `rgba(${r},${g},${b},${op * 0.3})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - p.size * 4, p.y - p.size * 4, p.size * 8, p.size * 8);
      // Bright core
      ctx.fillStyle = `rgba(255,${180 + Math.floor(g * 0.3)},${60 + Math.floor(b)},${op})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  wto: {
    colors: [[74, 111, 165], [100, 130, 180], [60, 80, 140], [140, 160, 200]],
    count: 30,
    create: (w, h, stagger) => ({
      // Ghostly wisps drifting
      x: Math.random() * w,
      y: Math.random() * h,
      size: 40 + Math.random() * 100,
      baseOpacity: 0.015 + Math.random() * 0.03,
      opacity: 0,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -(0.05 + Math.random() * 0.15),
      life: stagger ? Math.floor(Math.random() * 700) : 0,
      maxLife: 500 + Math.floor(Math.random() * 500),
      noisePhase: Math.random() * Math.PI * 2,
      noiseSpeed: 0.004 + Math.random() * 0.006,
      noiseAmp: 0.6 + Math.random() * 1.0,
    }),
    draw: (ctx, p, color) => {
      const [r, g, b] = color;
      const noise = Math.sin(p.life * p.noiseSpeed + p.noisePhase) * p.noiseAmp;
      p.x += noise;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      grad.addColorStop(0, `rgba(${r},${g},${b},${p.opacity})`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},${p.opacity * 0.4})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  htr: {
    colors: [[139, 128, 0], [180, 160, 30], [100, 90, 10], [200, 180, 50]],
    count: 20,
    create: (w, h, stagger) => ({
      // Focused light shafts / dust motes
      x: Math.random() * w,
      y: stagger ? Math.random() * h : -20,
      size: 1.5 + Math.random() * 2.5,
      baseOpacity: 0.05 + Math.random() * 0.08,
      opacity: 0,
      vx: (Math.random() - 0.5) * 0.05,
      vy: 0.1 + Math.random() * 0.25,
      life: stagger ? Math.floor(Math.random() * 600) : 0,
      maxLife: 500 + Math.floor(Math.random() * 500),
      shimmer: Math.random() * Math.PI * 2,
      shimmerSpeed: 0.03 + Math.random() * 0.06,
    }),
    draw: (ctx, p, color) => {
      const [r, g, b] = color;
      const shimmer = 0.4 + 0.6 * Math.sin(p.life * p.shimmerSpeed + p.shimmer);
      const op = p.opacity * shimmer;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 6);
      grad.addColorStop(0, `rgba(${r},${g},${b},${op})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${op * 0.3})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - p.size * 6, p.y - p.size * 6, p.size * 12, p.size * 12);
      ctx.fillStyle = `rgba(${r + 50},${g + 50},${b + 30},${op * 1.2})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  ctd: {
    colors: [[106, 79, 184], [150, 120, 220], [80, 60, 160], [200, 160, 255]],
    count: 30,
    create: (w, h, stagger) => ({
      // Dreamy shimmer motes floating upward
      x: Math.random() * w,
      y: stagger ? Math.random() * h : h + 10,
      size: 2 + Math.random() * 4,
      baseOpacity: 0.05 + Math.random() * 0.08,
      opacity: 0,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(0.15 + Math.random() * 0.35),
      life: stagger ? Math.floor(Math.random() * 600) : 0,
      maxLife: 450 + Math.floor(Math.random() * 400),
      hueShift: Math.random() * Math.PI * 2,
      hueSpeed: 0.015 + Math.random() * 0.02,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.02 + Math.random() * 0.04,
    }),
    draw: (ctx, p, color) => {
      const [r, g, b] = color;
      const hue = Math.sin(p.life * p.hueSpeed + p.hueShift);
      const wobble = Math.sin(p.life * p.wobbleSpeed + p.wobble) * 1.5;
      p.x += wobble * 0.1;
      const cr = Math.floor(r + hue * 40);
      const cg = Math.floor(g + hue * 20);
      const cb = Math.floor(b + hue * 30);
      // Outer glow
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${p.opacity * 0.6})`);
      grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},${p.opacity * 0.2})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - p.size * 5, p.y - p.size * 5, p.size * 10, p.size * 10);
      // Bright core
      ctx.fillStyle = `rgba(${Math.min(255, cr + 80)},${Math.min(255, cg + 60)},${Math.min(255, cb + 40)},${p.opacity})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
};

// Fallback for "mixed" or unknown types
const DEFAULT_PARTICLES = GAME_PARTICLES.vtm;

export default function DynamicBackground({ gameTypeId, bgImage }) {
  const canvasRef = useRef(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panRef = useRef({ angle: Math.random() * Math.PI * 2, time: 0 });

  // Slow pan/parallax for the background image
  useEffect(() => {
    let animId;
    const pan = panRef.current;
    function animatePan() {
      pan.time += 0.0003;
      const x = Math.sin(pan.time + pan.angle) * 12;
      const y = Math.cos(pan.time * 0.7 + pan.angle) * 8;
      setPanOffset({ x, y });
      animId = requestAnimationFrame(animatePan);
    }
    animatePan();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Themed particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const config = GAME_PARTICLES[gameTypeId] || DEFAULT_PARTICLES;
    const particles = [];
    for (let i = 0; i < config.count; i++) {
      const p = config.create(canvas.width, canvas.height, true);
      p.colorIdx = Math.floor(Math.random() * config.colors.length);
      particles.push(p);
    }

    function animate() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.life++;
        const t = p.life / p.maxLife;

        // Fade curve
        if (t < 0.15) {
          p.opacity = p.baseOpacity * (t / 0.15);
        } else if (t > 0.7) {
          p.opacity = p.baseOpacity * (1 - (t - 0.7) / 0.3);
        } else {
          p.opacity = p.baseOpacity;
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.opacity > 0.001) {
          config.draw(ctx, p, config.colors[p.colorIdx]);
        }

        if (p.life >= p.maxLife) {
          Object.assign(p, config.create(w, h, false));
          p.colorIdx = Math.floor(Math.random() * config.colors.length);
        }
      }

      animId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [gameTypeId]);

  return (
    <>
      {/* Parallax panning background image */}
      {bgImage && (
        <div style={{
          position: "fixed", inset: "-20px",
          backgroundImage: `linear-gradient(180deg, rgba(8,8,13,0.72) 0%, rgba(13,13,20,0.78) 40%, rgba(10,10,18,0.84) 100%), url("${bgImage}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(1.04)`,
          transition: "transform 0.1s linear",
          zIndex: 0,
        }} />
      )}
      {/* Themed particle overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
    </>
  );
}
