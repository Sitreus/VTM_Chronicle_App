export default function ProgressClock({ segments, filled, size = 60, accent = "#c41e3a", onClick }) {
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  if (!segments || segments < 1) segments = 1;
  const angleStep = (2 * Math.PI) / segments;

  return (
    <svg width={size} height={size} style={{ cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`${accent}30`} strokeWidth={1.5} />
      {Array.from({ length: segments }).map((_, i) => {
        const startAngle = i * angleStep - Math.PI / 2;
        const endAngle = (i + 1) * angleStep - Math.PI / 2;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = angleStep > Math.PI ? 1 : 0;
        const isFilled = i < filled;
        return (
          <g key={i}>
            <path
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={isFilled ? `${accent}90` : `${accent}10`}
              stroke={`${accent}40`} strokeWidth={0.5}
            />
          </g>
        );
      })}
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fill={filled >= segments ? "#ff6b6b" : accent}
        fontSize={size * 0.28} fontFamily="'Cinzel', serif" fontWeight="700">
        {filled}/{segments}
      </text>
    </svg>
  );
}
