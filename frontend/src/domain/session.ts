export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || value.includes('\\') || /[\r\n]/.test(value)) return '/workspace';
  const pathname = value.split(/[?#]/)[0];
  const allowed = /^\/(?:explore|workspace|compare|preferences|sources|colleges\/[a-z0-9-]+)?$/;
  return allowed.test(pathname) ? value : '/workspace';
}
