import { useState, useEffect } from 'react';
import { SI_PREFIX, slugFromValue } from '../../components/service-icon-picker.component';
import type { ServiceIcon } from '../../components/service-icons.data';

export { SI_PREFIX };

/** Ensures a URL has a protocol — bare hostnames become https:// links. */
export function toAbsoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function hasServiceIcon(iconValue: string): boolean {
  return iconValue.startsWith(SI_PREFIX);
}

function useServiceIcon(iconValue: string): ServiceIcon | null {
  const [icon, setIcon] = useState<ServiceIcon | null>(null);

  useEffect(() => {
    const slug = slugFromValue(iconValue);
    if (!slug) { setIcon(null); return; }
    void import('../../components/service-icons.data').then(mod => {
      setIcon(mod.SERVICE_ICONS.find(i => i.slug === slug) ?? null);
    });
  }, [iconValue]);

  return icon;
}

interface AppIconProps {
  iconValue: string;
  size: number;
  /** Rendered as SVG <title> and aria-label — used for tooltip. */
  title?: string | undefined;
  className?: string | undefined;
}

export function AppIcon({ iconValue, size, title, className }: AppIconProps) {
  const icon = useServiceIcon(iconValue);
  if (!icon) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={`#${icon.hex}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={!title}
      aria-label={title}
      className={['app-icon-svg', className].filter(Boolean).join(' ')}
    >
      {title && <title>{title}</title>}
      <path d={icon.path} />
    </svg>
  );
}
