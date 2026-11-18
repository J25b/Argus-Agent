import dns from 'node:dns';
import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  '169.254.169.254',
]);

export function normalizeDomain(input: string): string {
  let clean = input.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, '');
  clean = clean.split('/')[0] ?? clean;
  clean = clean.split(':')[0] ?? clean;
  return clean.replace(/\.+$/, '');
}

export function validateTargetDomain(rawDomain: string): { valid: boolean; domain: string; reason?: string } {
  const domain = normalizeDomain(rawDomain);
  if (!domain || domain.length > 253) {
    return { valid: false, domain, reason: 'Domain must be between 1 and 253 characters.' };
  }
  if (net.isIP(domain) !== 0) {
    return { valid: false, domain, reason: 'Raw IP addresses are prohibited. Provide a valid public domain hostname.' };
  }
  if (
    BLOCKED_HOSTNAMES.has(domain) ||
    domain.endsWith('.local') ||
    domain.endsWith('.internal') ||
    domain.endsWith('.localhost') ||
    domain.endsWith('.arpa')
  ) {
    return { valid: false, domain, reason: 'Loopback, local, and internal metadata hostnames are blocked by SSRF policy.' };
  }
  const hostnameRegex = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
  if (!hostnameRegex.test(domain)) {
    return { valid: false, domain, reason: 'Invalid domain format. Example: app.example.com' };
  }
  return { valid: true, domain };
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && parts[2] === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return true; // Link-local fe80::/10
  }
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
  if (lower.startsWith('ff')) return true; // Multicast
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice(7);
    if (net.isIPv4(mapped)) return isPrivateOrReservedIpv4(mapped);
  }
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateOrReservedIpv4(ip);
  if (version === 6) return isPrivateOrReservedIpv6(ip);
  return true;
}

export async function resolveAndAssertPublicIp(hostname: string): Promise<{ addresses: string[] }> {
  const check = validateTargetDomain(hostname);
  if (!check.valid) {
    throw new Error(check.reason || 'Invalid target hostname.');
  }

  let records: dns.LookupAddress[];
  try {
    records = await dns.promises.lookup(check.domain, { all: true });
  } catch (err) {
    throw new Error(`DNS resolution failed for ${check.domain}: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  if (!records || records.length === 0) {
    throw new Error(`No DNS A/AAAA records resolved for ${check.domain}.`);
  }

  for (const r of records) {
    if (isBlockedIp(r.address)) {
      throw new Error(`SSRF protection blocked connection: ${check.domain} resolved to non-public address (${r.address}).`);
    }
  }

  return { addresses: records.map((r) => r.address) };
}

export async function verifyTargetOwnership(
  domain: string,
  method: 'dns_txt' | 'http_file',
  expectedToken: string
): Promise<{ verified: boolean; evidence: string; error?: string }> {
  const check = validateTargetDomain(domain);
  if (!check.valid) {
    return { verified: false, evidence: '', error: check.reason };
  }

  if (method === 'dns_txt') {
    const hostsToCheck = [`_argus-verify.${check.domain}`, check.domain];
    const observed: string[] = [];
    for (const host of hostsToCheck) {
      try {
        const txtRecords = await dns.promises.resolveTxt(host);
        const flat = txtRecords.map((chunks) => chunks.join(''));
        for (const record of flat) {
          observed.push(`${host}: ${record}`);
          if (record.includes(expectedToken)) {
            return {
              verified: true,
              evidence: `DNS TXT verification succeeded. Found token in TXT record on ${host}.`,
            };
          }
        }
      } catch {
        // Ignore ENODATA / ENOTFOUND on first candidate and try apex
      }
    }
    return {
      verified: false,
      evidence: observed.length > 0 ? `Observed TXT records: ${observed.slice(0, 5).join(' | ')}` : 'No matching TXT records found.',
      error: `Verification token "${expectedToken}" not found in DNS TXT records for _argus-verify.${check.domain} or ${check.domain}.`,
    };
  }

  // HTTP file verification
  try {
    await resolveAndAssertPublicIp(check.domain);
    const url = `https://${check.domain}/.well-known/argus-verification.txt`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'ARGUS-Ownership-Verifier/1.0' },
    });
    clearTimeout(timeout);

    if (resp.status >= 300 && resp.status < 400) {
      return {
        verified: false,
        evidence: `HTTP ${resp.status} redirect returned at ${url}.`,
        error: 'HTTP verification blocked redirect to prevent unsafe redirect/SSRF bypass. Serve the verification file directly with HTTP 200.',
      };
    }

    if (!resp.ok) {
      return {
        verified: false,
        evidence: `HTTP ${resp.status} ${resp.statusText} at ${url}.`,
        error: `Verification file not reachable (HTTP ${resp.status}). Ensure ${url} returns HTTP 200 containing "${expectedToken}".`,
      };
    }

    const text = (await resp.text()).slice(0, 4096);
    if (text.includes(expectedToken)) {
      return {
        verified: true,
        evidence: `HTTP 200 verification succeeded at ${url}. Token matched.`,
      };
    }
    return {
      verified: false,
      evidence: `HTTP 200 received at ${url}, but expected token was not present.`,
      error: `File at ${url} does not contain verification token "${expectedToken}".`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Request failed';
    return {
      verified: false,
      evidence: `HTTP verification error: ${msg}`,
      error: `Unable to fetch verification file over HTTPS: ${msg}`,
    };
  }
}

export function sanitizeUntrustedWebContent(raw: string, maxLen = 2500): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, maxLen)
    .trim();
}
