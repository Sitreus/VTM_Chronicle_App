import { useEffect, useRef } from "react";

const SMOKE_COLORS = [
  [180, 175, 185],  // cool gray
  [160, 150, 165],  // muted purple-gray
  [196, 30, 58],    // crimson accent
  [140, 20, 40],    // dark red
  [120, 110, 125],  // neutral gray
  [90, 70, 80],     // warm shadow
];

const PARTICLE_COUNT = 50;

function createParticle(w, h, stagger) {
  const color = SMOKE_COLORS[Math.floor(Math.random() * SMOKE_COLORS.length)];
  return {
    x: Math.random() * w,
    y: h * (0.3 + Math.random() * 0.7),
    size: 60 + Math.random() * 180,
    baseOpacity: 0.02 + Math.random() * 0.06,
    opacity: 0,
    vx: (Math.random() - 0.5) * 0.15,
    vy: -(0.15 + Math.random() * 0.35),
    life: stagger ? Math.floor(Math.random() * 800) : 0,
    maxLife: 400 + Math.floor(Math.random() * 600),
    growRate: 0.15 + Math.random() * 0.3,
    color,
    noisePhase: Math.random() * Math.PI * 2,
    noiseSpeed: 0.003 + Math.random() * 0.005,
    noiseAmp: 0.3 + Math.random() * 0.5,
  };
}

function resetParticle(p, w, h) {
  const color = SMOKE_COLORS[Math.floor(Math.random() * SMOKE_COLORS.length)];
  p.x = Math.random() * w;
  p.y = h * (0.5 + Math.random() * 0.5);
  p.size = 60 + Math.random() * 180;
  p.baseOpacity = 0.02 + Math.random() * 0.06;
  p.opacity = 0;
  p.vx = (Math.random() - 0.5) * 0.15;
  p.vy = -(0.15 + Math.random() * 0.35);
  p.life = 0;
  p.maxLife = 400 + Math.floor(Math.random() * 600);
  p.growRate = 0.15 + Math.random() * 0.3;
  p.color = color;
  p.noisePhase = Math.random() * Math.PI * 2;
  p.noiseSpeed = 0.003 + Math.random() * 0.005;
  p.noiseAmp = 0.3 + Math.random() * 0.5;
}

export default function SmokeCanvas() {
  const canvasRef = useRef(null);

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

    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle(canvas.width, canvas.height, true));
    }

    function animate() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.life++;
        const t = p.life / p.maxLife;

        // Smooth fade curve: ease-in 15%, sustain, ease-out last 30%
        if (t < 0.15) {
          p.opacity = p.baseOpacity * (t / 0.15);
        } else if (t > 0.7) {
          p.opacity = p.baseOpacity * (1 - (t - 0.7) / 0.3);
        } else {
          p.opacity = p.baseOpacity;
        }

        // Movement with sinusoidal drift
        const noise = Math.sin(p.life * p.noiseSpeed + p.noisePhase) * p.noiseAmp;
        p.x += p.vx + noise;
        p.y += p.vy;
        p.size += p.growRate;

        // Draw radial gradient smoke blob
        if (p.opacity > 0.001) {
          const [r, g, b] = p.color;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          grad.addColorStop(0, `rgba(${r},${g},${b},${p.opacity})`);
          grad.addColorStop(0.4, `rgba(${r},${g},${b},${p.opacity * 0.6})`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        if (p.life >= p.maxLife) {
          resetParticle(p, w, h);
        }
      }

      animId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
