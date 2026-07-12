// Mirrors the backend's target classification (widgets/healthcheck/check.ts):
// a target is a bare host/IP (ICMP), host:port (TCP), or http(s):// URL (TCP).
// Empty is valid — the target field is optional; an unconfigured widget simply
// reports 'unknown'. Keep these rules in sync with the backend.

const MAX_HOSTNAME_LENGTH = 253;
const SAFE_HOST_RE = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
const IPV6_RE = /^[0-9a-fA-F:]+:[0-9a-fA-F:]*$/;
const MAX_PORT = 65535;

function isValidHostname(host: string): boolean {
  return host.length <= MAX_HOSTNAME_LENGTH && (SAFE_HOST_RE.test(host) || IPV6_RE.test(host));
}

export function isValidHealthcheckTarget(raw: string): boolean {
  const input = raw.trim();
  if (input === '') return true;

  if (input.includes('://')) {
    try {
      const parsed = new URL(input);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0;
    } catch {
      return false;
    }
  }

  // host:port — only when the part after the last colon is purely numeric,
  // so bare IPv6 addresses (multiple colons, hex groups) aren't split.
  const portMatch = /^(.+):(\d{1,5})$/.exec(input);
  if (portMatch && !IPV6_RE.test(input)) {
    const port = parseInt(portMatch[2]!, 10);
    return port >= 1 && port <= MAX_PORT && isValidHostname(portMatch[1]!);
  }

  return isValidHostname(input);
}

/** Normalize a target before saving: trim whitespace. */
export function sanitizeHealthcheckTarget(raw: string): string {
  return raw.trim();
}
