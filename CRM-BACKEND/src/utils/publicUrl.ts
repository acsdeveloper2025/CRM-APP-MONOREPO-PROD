import type { Request } from 'express';
import { config } from '@/config';

const PROD_HOSTS = ['example.com', 'www.example.com'];

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function getForwardedProtocol(req: Request): 'http' | 'https' {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedProto === 'https' || forwardedProto === 'http') {
    return forwardedProto;
  }
  return req.secure ? 'https' : 'http';
}

function getRequestHost(req: Request): string {
  return (
    req.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.get('host')?.trim() ||
    `localhost:${config.port}`
  );
}

function isProductionHost(host: string): boolean {
  return PROD_HOSTS.some(prodHost => host.includes(prodHost));
}

function getStaticIp(): string | null {
  const value = process.env.STATIC_IP?.trim();
  return value ? value : null;
}

export function getApiBaseUrl(req: Request, options?: { mobile?: boolean }): string {
  const mobile = options?.mobile === true;
  const explicitBaseUrl = mobile
    ? process.env.MOBILE_API_BASE_URL?.trim()
    : process.env.API_BASE_URL?.trim();

  if (explicitBaseUrl) {
    return stripTrailingSlash(explicitBaseUrl);
  }

  const host = getRequestHost(req);
  if (isProductionHost(host)) {
    return `https://example.com/api${mobile ? '/mobile' : ''}`;
  }

  const staticIp = getStaticIp();
  if (staticIp && host.includes(staticIp)) {
    return `http://${staticIp}:${config.port}/api${mobile ? '/mobile' : ''}`;
  }

  const protocol = getForwardedProtocol(req);
  return `${protocol}://${host}/api${mobile ? '/mobile' : ''}`;
}

export function getWsUrl(req: Request): string {
  const explicitWsUrl = process.env.WS_URL?.trim() || process.env.MOBILE_WS_URL?.trim();
  if (explicitWsUrl) {
    return stripTrailingSlash(explicitWsUrl);
  }

  const host = getRequestHost(req);
  if (isProductionHost(host)) {
    return 'wss://example.com';
  }

  const staticIp = getStaticIp();
  if (staticIp && host.includes(staticIp)) {
    return `ws://${staticIp}:${config.wsPort}`;
  }

  const protocol = getForwardedProtocol(req) === 'https' ? 'wss' : 'ws';
  return `${protocol}://${host}`;
}
