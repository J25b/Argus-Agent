import dns from 'node:dns';
import tls from 'node:tls';
import { resolveAndAssertPublicIp, sanitizeUntrustedWebContent } from './security.ts';

export interface DnsAnalysisResult {
  domain: string;
  a: string[];
  aaaa: string[];
  ns: string[];
  mx: { exchange: string; priority: number }[];
  txt: string[];
  dmarc: string[];
  caa: { critical: number; issue?: string; issuewild?: string }[];
  spfPresent: boolean;
  dmarcPresent: boolean;
}

export interface TlsInspectionResult {
  domain: string;
  connected: boolean;
  protocol: string | null;
  cipherName: string | null;
  authorized: boolean;
  authorizationError: string | null;
  subjectCN: string | null;
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
  sanList: string[];
  error?: string;
}

export interface HttpHeaderCheckResult {
  url: string;
  status: number;
  redirectLocation: string | null;
  headers: Record<string, string>;
  missingSecurityHeaders: string[];
  disclosedHeaders: Record<string, string>;
  cookieIssues: string[];
}

export interface TechFingerprintResult {
  url: string;
  technologies: { name: string; source: string }[];
  generatorMeta: string | null;
}

export interface PublicMetadataResult {
  domain: string;
  securityTxtFound: boolean;
  securityTxtSnippet: string | null;
  robotsTxtFound: boolean;
  robotsTxtSnippet: string | null;
}

export async function runDnsAnalysis(domain: string, signal?: AbortSignal): Promise<DnsAnalysisResult> {
  if (signal?.aborted) throw new Error('Assessment cancelled');
  await resolveAndAssertPublicIp(domain);

  const safeResolve = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  const [a, aaaa, ns, mx, txtRaw, dmarcRaw, caaRaw] = await Promise.all([
    safeResolve(() => dns.promises.resolve4(domain), []),
    safeResolve(() => dns.promises.resolve6(domain), []),
    safeResolve(() => dns.promises.resolveNs(domain), []),
    safeResolve(() => dns.promises.resolveMx(domain), []),
    safeResolve(() => dns.promises.resolveTxt(domain), []),
    safeResolve(() => dns.promises.resolveTxt(`_dmarc.${domain}`), []),
    safeResolve(() => dns.promises.resolveCaa(domain), []),
  ]);

  const txt = txtRaw.map((chunks) => chunks.join(''));
  const dmarc = dmarcRaw.map((chunks) => chunks.join(''));
  const spfPresent = txt.some((r) => r.toLowerCase().includes('v=spf1'));
  const dmarcPresent = dmarc.some((r) => r.toLowerCase().includes('v=dmarc1'));

  return {
    domain,
    a,
    aaaa,
    ns,
    mx: mx.map((m) => ({ exchange: m.exchange, priority: m.priority })),
    txt,
    dmarc,
    caa: caaRaw.map((c) => ({ critical: c.critical, issue: c.issue, issuewild: c.issuewild })),
    spfPresent,
    dmarcPresent,
  };
}

export async function runTlsInspection(domain: string, signal?: AbortSignal): Promise<TlsInspectionResult> {
  if (signal?.aborted) throw new Error('Assessment cancelled');
  const { addresses } = await resolveAndAssertPublicIp(domain);
  const targetIp = addresses[0];

  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: targetIp,
        port: 443,
        servername: domain,
        rejectUnauthorized: false,
        timeout: 7000,
      },
      () => {
        try {
          const cipher = socket.getCipher();
          const protocol = socket.getProtocol();
          const cert = socket.getPeerCertificate(false);
          const authorized = socket.authorized;
          const authError = socket.authorizationError ? String(socket.authorizationError) : null;

          let daysRemaining: number | null = null;
          if (cert?.valid_to) {
            const expiry = new Date(cert.valid_to).getTime();
            daysRemaining = Math.floor((expiry - Date.now()) / (1000 * 60 * 60 * 24));
          }

          const sanRaw = typeof cert?.subjectaltname === 'string' ? cert.subjectaltname : '';
          const sanList = sanRaw
            ? sanRaw.split(',').map((s) => s.trim().replace(/^DNS:/, '')).slice(0, 20)
            : [];

          const issuerOrg =
            cert?.issuer && typeof cert.issuer === 'object'
              ? [cert.issuer.O, cert.issuer.CN].filter(Boolean).join(' — ')
              : null;

          const rawCN = cert?.subject?.CN;
          const subjectCN = Array.isArray(rawCN) ? rawCN[0] || null : rawCN || null;

          socket.end();
          resolve({
            domain,
            connected: true,
            protocol: protocol || null,
            cipherName: cipher?.name || null,
            authorized,
            authorizationError: authError,
            subjectCN,
            issuer: issuerOrg || null,
            validFrom: cert?.valid_from || null,
            validTo: cert?.valid_to || null,
            daysRemaining,
            sanList,
          });
        } catch (err) {
          socket.destroy();
          resolve({
            domain,
            connected: false,
            protocol: null,
            cipherName: null,
            authorized: false,
            authorizationError: null,
            subjectCN: null,
            issuer: null,
            validFrom: null,
            validTo: null,
            daysRemaining: null,
            sanList: [],
            error: err instanceof Error ? err.message : 'TLS inspection failed',
          });
        }
      }
    );

    socket.setTimeout(7000, () => {
      socket.destroy();
      resolve({
        domain,
        connected: false,
        protocol: null,
        cipherName: null,
        authorized: false,
        authorizationError: null,
        subjectCN: null,
        issuer: null,
        validFrom: null,
        validTo: null,
        daysRemaining: null,
        sanList: [],
        error: 'TLS connection timed out after 7000ms.',
      });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({
        domain,
        connected: false,
        protocol: null,
        cipherName: null,
        authorized: false,
        authorizationError: null,
        subjectCN: null,
        issuer: null,
        validFrom: null,
        validTo: null,
        daysRemaining: null,
        sanList: [],
        error: err.message,
      });
    });
  });
}

export async function runHttpSecurityHeaders(
  domain: string,
  allowedPaths: string[],
  excludedPaths: string[],
  signal?: AbortSignal
): Promise<HttpHeaderCheckResult> {
  if (signal?.aborted) throw new Error('Assessment cancelled');
  await resolveAndAssertPublicIp(domain);

  const candidatePath = allowedPaths[0] && allowedPaths[0].startsWith('/') ? allowedPaths[0] : '/';
  if (excludedPaths.some((ex) => ex && candidatePath.startsWith(ex))) {
    throw new Error(`Path ${candidatePath} is excluded by target scope policy.`);
  }

  const url = `https://${domain}${candidatePath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'ARGUS-Security-Assessment/1.0' },
    });

    const headers: Record<string, string> = {};
    resp.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value.slice(0, 512);
    });

    const requiredHeaders = [
      'strict-transport-security',
      'content-security-policy',
      'x-content-type-options',
      'x-frame-options',
      'referrer-policy',
      'permissions-policy',
    ];

    const missingSecurityHeaders = requiredHeaders.filter((h) => !headers[h]);
    const disclosedHeaders: Record<string, string> = {};
    for (const h of ['server', 'x-powered-by', 'x-aspnet-version']) {
      if (headers[h]) disclosedHeaders[h] = headers[h];
    }

    const cookieIssues: string[] = [];
    const setCookieHeader = resp.headers.get('set-cookie');
    if (setCookieHeader) {
      const lower = setCookieHeader.toLowerCase();
      if (!lower.includes('secure')) cookieIssues.push('Cookie missing Secure flag');
      if (!lower.includes('httponly')) cookieIssues.push('Cookie missing HttpOnly flag');
      if (!lower.includes('samesite=')) cookieIssues.push('Cookie missing SameSite attribute');
    }

    return {
      url,
      status: resp.status,
      redirectLocation: headers['location'] || null,
      headers,
      missingSecurityHeaders,
      disclosedHeaders,
      cookieIssues,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function runTechFingerprint(domain: string, signal?: AbortSignal): Promise<TechFingerprintResult> {
  if (signal?.aborted) throw new Error('Assessment cancelled');
  await resolveAndAssertPublicIp(domain);

  const url = `https://${domain}/`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'ARGUS-Tech-Fingerprint/1.0' },
    });

    const technologies: { name: string; source: string }[] = [];
    const server = resp.headers.get('server');
    const poweredBy = resp.headers.get('x-powered-by');
    const cfRay = resp.headers.get('cf-ray');
    const xVercel = resp.headers.get('x-vercel-id');

    if (server) technologies.push({ name: sanitizeUntrustedWebContent(server, 80), source: 'Server header' });
    if (poweredBy) technologies.push({ name: sanitizeUntrustedWebContent(poweredBy, 80), source: 'X-Powered-By header' });
    if (cfRay) technologies.push({ name: 'Cloudflare Edge / WAF', source: 'cf-ray header' });
    if (xVercel) technologies.push({ name: 'Vercel Edge Network', source: 'x-vercel-id header' });

    const bodyText = sanitizeUntrustedWebContent(await resp.text(), 12000);
    const genMatch = bodyText.match(/<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i);
    const generatorMeta = genMatch?.[1] ? sanitizeUntrustedWebContent(genMatch[1], 100) : null;
    if (generatorMeta) {
      technologies.push({ name: generatorMeta, source: 'HTML meta generator' });
    }
    if (bodyText.includes('__NEXT_DATA__')) {
      technologies.push({ name: 'Next.js', source: 'Document runtime signature' });
    }

    return { url, technologies, generatorMeta };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function runPublicMetadataCheck(
  domain: string,
  allowedPaths: string[],
  excludedPaths: string[],
  signal?: AbortSignal
): Promise<PublicMetadataResult> {
  if (signal?.aborted) throw new Error('Assessment cancelled');
  await resolveAndAssertPublicIp(domain);

  const checkPath = async (p: string): Promise<{ found: boolean; snippet: string | null }> => {
    if (excludedPaths.some((ex) => ex && p.startsWith(ex))) {
      return { found: false, snippet: null };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetch(`https://${domain}${p}`, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'ARGUS-Metadata-Inspector/1.0' },
      });
      if (!resp.ok) return { found: false, snippet: null };
      const text = sanitizeUntrustedWebContent(await resp.text(), 600);
      return { found: true, snippet: text || null };
    } catch {
      return { found: false, snippet: null };
    } finally {
      clearTimeout(timer);
    }
  };

  const [sec, robots] = await Promise.all([
    checkPath('/.well-known/security.txt'),
    checkPath('/robots.txt'),
  ]);

  return {
    domain,
    securityTxtFound: sec.found,
    securityTxtSnippet: sec.snippet,
    robotsTxtFound: robots.found,
    robotsTxtSnippet: robots.snippet,
  };
}
