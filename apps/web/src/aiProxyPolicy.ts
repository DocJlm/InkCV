const BUILTIN_HOSTS = new Set([
  'api.openai.com',
  'api.deepseek.com',
  'api.anthropic.com',
  'api.moonshot.cn',
]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIpv6(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host.includes(':')) return false;
  if (host === '::' || host === '::1' || host.startsWith('fe8') || host.startsWith('fe9') ||
      host.startsWith('fea') || host.startsWith('feb') || host.startsWith('fc') || host.startsWith('fd')) return true;
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped ? isPrivateIpv4(mapped) : false;
}

export function configuredHosts(value: string | undefined): Set<string> {
  return new Set((value ?? '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean));
}

export function validateProviderUrl(
  rawUrl: string,
  options: { production: boolean; extraHosts?: Set<string> },
): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('invalid_url');
  }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('https_required');
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
    isPrivateIpv6(host) || isPrivateIpv4(host)
  ) throw new Error('private_host');
  if (options.production && !BUILTIN_HOSTS.has(host) && !options.extraHosts?.has(host)) {
    throw new Error('host_not_allowed');
  }
  return url;
}

export function isAllowedOrigin(requestUrl: string, origin: string | null): boolean {
  if (!origin) return false;
  try {
    return new URL(requestUrl).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}
