/**
 * LiquidCard — glass card with squircle corners, displacement refraction, and rim highlight.
 * Technique ported from github.com/FezVrasta/liquid-glass (originally by Shu Ding).
 */
import { memo, useRef, useLayoutEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import './LiquidCard.css';

// ── Feature detection (computed once at module load) ─────────────────────────
const supportsBackdropUrl =
  typeof CSS !== 'undefined' &&
  CSS.supports('backdrop-filter', 'url(#x)');

// ── Math ─────────────────────────────────────────────────────────────────────

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
 * Build a displacement map encoding a Gaussian refraction ring around the
 * squircle boundary. Each pixel's R/G channels store the outward surface
 * normal scaled by a Gaussian bell, so feDisplacementMap bends the backdrop
 * outward near each edge/corner — the 3D glass lens effect.
 *
 * Encoding: R=128/G=128 → neutral (no shift).
 * feDisplacementMap formula: shift = (channel/255 − 0.5) × scale.
 * We return scale = sigma × refractionMultiplier × 2, giving a peak shift
 * of sigma × refractionMultiplier pixels at the card boundary.
 */
function buildDisplacementMap(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  refractionMultiplier: number,
  cardRadius: number
): number {
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  const total = pw * ph;
  const pixelBuffer = new Uint8ClampedArray(total * 4);

  // sigma: width of the Gaussian refraction band. Proportional to corner
  // radius so small-radius cards stay crisp and large ones spread gracefully.
  const sigma = Math.max(cardRadius, 8);
  const twoSigmaSq = 2 * sigma * sigma;

  // SDF half-extents in pixel space, matching squirclePath's geometry exactly.
  const hw = w / 2 - cardRadius;
  const hh = h / 2 - cardRadius;

  // feDisplacementMap scale: shift = (R/255 − 0.5) × scale.
  // Peak dispX/dispY values are ±1 (from normX/normY × edgeMask ≈ 1).
  // We want peak pixel shift = sigma × refractionMultiplier.
  // Encoding: R = dispX × 127 + 128 → at R=255, dispX=1.
  // Shift at R=255 = (255/255 − 0.5) × scale = 0.5 × scale.
  // So: 0.5 × scale = sigma × refractionMultiplier → scale = sigma × mult × 2.
  const scale = sigma * refractionMultiplier * 2;

  for (let i = 0; i < total; i++) {
    const px = i % pw;
    const py = Math.floor(i / pw);

    // Map physical pixel back to logical coordinates centered at card origin.
    const cx = px / dpr - w / 2;
    const cy = py / dpr - h / 2;

    // Squircle SDF in pixel space: negative inside, 0 at boundary, positive outside.
    const sdf = squircleSDF(cx, cy, hw, hh, cardRadius);

    // Gaussian bell centered on boundary (sdf = 0).
    // Falls to ~0 deep inside (no distortion at card centre) and outside.
    const edgeMask = Math.exp(-(sdf * sdf) / twoSigmaSq);

    // Outward surface normal via 1-pixel forward finite difference.
    const gradX = squircleSDF(cx + 1, cy, hw, hh, cardRadius) - sdf;
    const gradY = squircleSDF(cx, cy + 1, hw, hh, cardRadius) - sdf;
    const gradLen = Math.sqrt(gradX * gradX + gradY * gradY) || 1;
    const normX = gradX / gradLen; // ∈ [−1, 1]
    const normY = gradY / gradLen;

    // Displacement vector: outward normal × edge proximity weight.
    const dispX = normX * edgeMask; // ∈ [−1, 1]
    const dispY = normY * edgeMask;

    // Encode: 128 = neutral, 1 = −peak, 255 = +peak.
    pixelBuffer[i * 4]     = Math.max(0, Math.min(255, Math.round(dispX * 127 + 128)));
    pixelBuffer[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(dispY * 127 + 128)));
    pixelBuffer[i * 4 + 2] = 0;
    pixelBuffer[i * 4 + 3] = 255;
  }

  ctx.putImageData(new ImageData(pixelBuffer, pw, ph), 0, 0);
  return scale;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GlassState {
  w: number;
  h: number;
  scale: number;
}

interface Props {
  children: ReactNode;
  className?: string | undefined;
  radius?: number | undefined;
  style?: CSSProperties | undefined;
}

export const LiquidCard = memo(function LiquidCard({ children, className = '', radius = 20, style }: Props) {
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
  const edgeGradId = `lg-edge-${uid}`;
  const rimId = `lg-rim-${uid}`;

  const [ready, setReady] = useState(false);
  const [state, setState] = useState<GlassState>({ w: 0, h: 0, scale: 0 });

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const recalculateGlassEffect = () => {
      const cardWidth = el.offsetWidth;
      const cardHeight = el.offsetHeight;
      if (cardWidth === 0 || cardHeight === 0) return;

      // Read physics vars from CSS custom properties.
      const computedStyle = getComputedStyle(el);
      const refractionMultiplier =
        parseFloat(computedStyle.getPropertyValue('--glass-refraction').trim()) || 1.0;

      // Rebuild displacement map on canvas.
      const scale = buildDisplacementMap(
        canvasRef.current!, cardWidth, cardHeight, refractionMultiplier, radius
      );

      // Update SVG refs imperatively to avoid React re-render on every resize.
      if (feImageRef.current && canvasRef.current) {
        // Use plain href (not xlink:href which is deprecated in SVG 2.0 and
        // silently ignored by modern Chromium).
        feImageRef.current.setAttribute('href', canvasRef.current.toDataURL());
        feImageRef.current.setAttribute('width', String(cardWidth));
        feImageRef.current.setAttribute('height', String(cardHeight));
      }
      if (feDispRef.current) {
        feDispRef.current.setAttribute('scale', String(scale));
      }
      if (maskPathRef.current) {
        maskPathRef.current.setAttribute('d', squirclePath(cardWidth, cardHeight, radius));
      }
      if (rimPathRef.current) {
        rimPathRef.current.setAttribute('d', squirclePath(cardWidth, cardHeight, radius, 0.75));
      }
      if (svgRef.current) {
        svgRef.current.setAttribute('viewBox', `0 0 ${cardWidth} ${cardHeight}`);
        svgRef.current.setAttribute('width', String(cardWidth));
        svgRef.current.setAttribute('height', String(cardHeight));
      }

      setState({ w: cardWidth, h: cardHeight, scale });
      setReady(true);
    };

    recalculateGlassEffect();
    const ro = new ResizeObserver(recalculateGlassEffect);
    ro.observe(el);
    return () => ro.disconnect();
  }, [radius]);

  // Initial squircle paths (updated imperatively on resize).
  const initPath    = state.w > 0 ? squirclePath(state.w, state.h, radius)        : '';
  const initRimPath = state.w > 0 ? squirclePath(state.w, state.h, radius, 0.75)  : '';

  return (
    <div
      ref={cardRef}
      className={`liquid-card ${className}`}
      style={(ready || style) ? {
        ...(ready ? {
          WebkitMaskImage: `url(#${maskId})`,
          maskImage: `url(#${maskId})`,
          ...(supportsBackdropUrl && {
            backdropFilter: `url(#${filterId}) blur(4px) saturate(140%)`,
          }),
        } : {}),
        ...style,
      } : undefined}
    >
      {/* SVG: displacement filter + squircle mask + rim + inner edge shadow */}
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
          {/* Squircle clip mask */}
          <mask id={maskId} maskUnits="userSpaceOnUse">
            <path ref={maskPathRef} d={initPath} fill="white" />
          </mask>

          {/* Displacement filter — drives backdrop-filter on Chromium */}
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

          {/* Radial gradient for edge vignette — center clear, edges darken. */}
          <radialGradient id={edgeGradId} cx="50%" cy="50%" r="65%">
            <stop offset="45%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.14)" />
          </radialGradient>

          {/* Soft blur filter for the edge shadow stroke */}
          <filter id={`${edgeGradId}-blur`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="6" />
          </filter>

          {/* Rim gradient: bright top-left → transparent → soft bottom-right */}
          <linearGradient
            id={rimId}
            x1="0" y1="0"
            x2={state.w || 1} y2={state.h || 1}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor="rgba(255,255,255,0.75)" />
            <stop offset="35%"  stopColor="rgba(255,255,255,0)" />
            <stop offset="65%"  stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.45)" />
          </linearGradient>
        </defs>

        {/* Glass tint layer.
            On Chromium: backdrop-filter on the div handles refraction — plain fill here.
            On other browsers: apply the displacement filter to the fill as a fallback. */}
        {ready && (
          <rect
            width={state.w}
            height={state.h}
            fill="var(--card-bg, rgba(255,255,255,0.05))"
            filter={supportsBackdropUrl ? undefined : `url(#${filterId})`}
          />
        )}

        {/* Edge depth — two layers:
            1. Radial vignette rect: broad dome falloff from center.
            2. Blurred stroke path: soft shadow band tracing the actual squircle
               boundary. Large blur (6px) spreads it inward without a hard line. */}
        {ready && (
          <>
            <rect
              width={state.w}
              height={state.h}
              fill={`url(#${edgeGradId})`}
            />
            <path
              d={squirclePath(state.w, state.h, radius, 1)}
              fill="none"
              stroke="rgba(0,0,0,0.10)"
              strokeWidth="8"
              filter={`url(#${edgeGradId}-blur)`}
            />
          </>
        )}

        {/* Rim specular highlight — simulates upper-left light source */}
        {ready && (
          <path
            ref={rimPathRef}
            d={initRimPath}
            fill="none"
            stroke={`url(#${rimId})`}
            strokeWidth="1.5"
          />
        )}
      </svg>

      {/* Card content */}
      <div className="liquid-content">
        {children}
      </div>
    </div>
  );
});
