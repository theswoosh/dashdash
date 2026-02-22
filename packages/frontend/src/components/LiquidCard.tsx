/**
 * LiquidCard — glass card with squircle corners, displacement refraction, and rim highlight.
 * Technique ported from github.com/FezVrasta/liquid-glass (originally by Shu Ding).
 */
import { useRef, useLayoutEffect, useId, useState, type ReactNode } from 'react';
import './LiquidCard.css';

// ── Math ─────────────────────────────────────────────────────────────────────

function smoothStep(a: number, b: number, t: number): number {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function squircleSDF(x: number, y: number, w: number, h: number, r: number): number {
  const qx = Math.max(Math.abs(x) - w + r, 0) / r;
  const qy = Math.max(Math.abs(y) - h + r, 0) / r;
  const dist = (qx ** 4 + qy ** 4) ** 0.25;
  const dx = Math.abs(x) - w + r;
  const dy = Math.abs(y) - h + r;
  return dist * r - r + Math.min(Math.max(dx, dy), 0);
}

/** SVG path for a squircle (superellipse) rounded rectangle. */
function squirclePath(w: number, h: number, r: number, o = 0): string {
  const k = r * (6 / 28); // ≈0.214r — tighter than circle bezier (0.552r)
  const L = o, T = o, R = w - o, B = h - o;
  return (
    `M${L},${T + r} C${L},${T + k} ${L + k},${T} ${L + r},${T} ` +
    `L${R - r},${T} C${R - k},${T} ${R},${T + k} ${R},${T + r} ` +
    `L${R},${B - r} C${R},${B - k} ${R - k},${B} ${R - r},${B} ` +
    `L${L + r},${B} C${L + k},${B} ${L},${B - k} ${L},${B - r} Z`
  );
}

/**
 * Render the lens-distortion displacement map onto a canvas.
 * The fragment function maps UV → UV such that pixels near the card
 * edge are bent inward, creating a magnifying-glass / liquid-glass refraction.
 */
function buildDisplacementMap(
  canvas: HTMLCanvasElement,
  w: number,
  h: number
): number {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  const total = w * h;
  const data = new Uint8ClampedArray(total * 4);
  const raw = new Float32Array(total * 2);
  let maxScale = 0;

  for (let i = 0; i < total; i++) {
    const px = i % w;
    const py = Math.floor(i / w);
    const ix = px / w - 0.5;
    const iy = py / h - 0.5;
    const d = squircleSDF(ix, iy, 0.3, 0.2, 0.6);
    const disp = smoothStep(0.8, 0, d - 0.15);
    const s = smoothStep(0, 1, disp);
    const dx = (ix * s + 0.5) * w - px;
    const dy = (iy * s + 0.5) * h - py;
    if (Math.abs(dx) > maxScale) maxScale = Math.abs(dx);
    if (Math.abs(dy) > maxScale) maxScale = Math.abs(dy);
    raw[i * 2] = dx;
    raw[i * 2 + 1] = dy;
  }

  maxScale *= 0.5;
  if (maxScale === 0) return 0;

  for (let i = 0; i < total; i++) {
    data[i * 4] = Math.round(((raw[i * 2] ?? 0) / maxScale + 0.5) * 255);
    data[i * 4 + 1] = Math.round(((raw[i * 2 + 1] ?? 0) / maxScale + 0.5) * 255);
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }

  ctx.putImageData(new ImageData(data, w, h), 0, 0);
  return maxScale;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GlassState {
  w: number;
  h: number;
  scale: number;
  // squircle path strings recomputed on resize
}

interface Props {
  children: ReactNode;
  className?: string;
  radius?: number;
}

export function LiquidCard({ children, className = '', radius = 20 }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const feImageRef = useRef<SVGFEImageElement | null>(null);
  const feDispRef = useRef<SVGFEDisplacementMapElement | null>(null);
  const maskPathRef = useRef<SVGPathElement | null>(null);
  const rimPathRef = useRef<SVGPathElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const uid = useId().replace(/:/g, '');
  const maskId = `lg-mask-${uid}`;
  const filterId = `lg-filter-${uid}`;
  const rimId = `lg-rim-${uid}`;

  const [ready, setReady] = useState(false);
  const [state, setState] = useState<GlassState>({ w: 0, h: 0, scale: 0 });

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const update = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w === 0 || h === 0) return;

      // Rebuild displacement map on canvas
      const scale = buildDisplacementMap(canvasRef.current!, w, h);

      // Update SVG refs imperatively to avoid React re-render on every resize
      if (feImageRef.current && canvasRef.current) {
        feImageRef.current.setAttributeNS(
          'http://www.w3.org/1999/xlink',
          'href',
          canvasRef.current.toDataURL()
        );
        feImageRef.current.setAttribute('width', String(w));
        feImageRef.current.setAttribute('height', String(h));
      }
      if (feDispRef.current) {
        feDispRef.current.setAttribute('scale', String(scale));
      }
      if (maskPathRef.current) {
        maskPathRef.current.setAttribute('d', squirclePath(w, h, radius));
      }
      if (rimPathRef.current) {
        rimPathRef.current.setAttribute('d', squirclePath(w, h, radius, 0.5));
      }
      if (svgRef.current) {
        svgRef.current.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svgRef.current.setAttribute('width', String(w));
        svgRef.current.setAttribute('height', String(h));
      }

      setState({ w, h, scale });
      setReady(true);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [radius]);

  // Initial squircle paths (will be updated imperatively on resize)
  const initPath = state.w > 0 ? squirclePath(state.w, state.h, radius) : '';
  const initRimPath = state.w > 0 ? squirclePath(state.w, state.h, radius, 0.5) : '';

  return (
    <div
      ref={cardRef}
      className={`liquid-card ${className}`}
      style={ready ? {
        WebkitMaskImage: `url(#${maskId})`,
        maskImage: `url(#${maskId})`,
      } : undefined}
    >
      {/* SVG: displacement filter + squircle mask + rim */}
      <svg
        ref={svgRef}
        className="liquid-overlay"
        width={state.w || 1}
        height={state.h || 1}
        viewBox={`0 0 ${state.w || 1} ${state.h || 1}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Squircle mask */}
          <mask id={maskId} maskUnits="userSpaceOnUse">
            <path ref={maskPathRef} d={initPath} fill="white" />
          </mask>

          {/* Displacement filter */}
          <filter
            id={filterId}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
            x="0" y="0"
            width={state.w || 1}
            height={state.h || 1}
          >
            <feImage
              ref={feImageRef}
              width={state.w || 1}
              height={state.h || 1}
              result="disp-map"
            />
            <feDisplacementMap
              ref={feDispRef}
              in="SourceGraphic"
              in2="disp-map"
              xChannelSelector="R"
              yChannelSelector="G"
              scale={state.scale}
            />
          </filter>

          {/* Rim gradient: bright top-left → transparent → soft bottom-right */}
          <linearGradient
            id={rimId}
            x1="0" y1="0"
            x2={state.w || 1} y2={state.h || 1}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
          </linearGradient>
        </defs>

        {/* Distorted glass layer — feDisplacementMap distorts this rect */}
        {ready && (
          <rect
            width={state.w}
            height={state.h}
            fill="var(--card-bg, rgba(255,255,255,0.05))"
            filter={`url(#${filterId})`}
          />
        )}

        {/* Rim stroke */}
        {ready && (
          <path
            ref={rimPathRef}
            d={initRimPath}
            fill="none"
            stroke={`url(#${rimId})`}
            strokeWidth="1"
          />
        )}
      </svg>

      {/* Card content */}
      <div className="liquid-content">
        {children}
      </div>
    </div>
  );
}
