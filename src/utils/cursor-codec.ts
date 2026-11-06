/**
 * Opaque cursor encoding: JSON -> UTF-8 -> base64url (RFC 4648 §5, no padding).
 * Dependency-free so it works in Node and browsers without Buffer/btoa typings.
 * Dates are tagged so they decode back to Date objects (drivers bind them natively).
 */

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DATE_TAG = '$date';

function toUtf8Bytes(str: string): number[] {
  const bytes: number[] = [];
  const encoded = encodeURIComponent(str);
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === '%') {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return bytes;
}

function fromUtf8Bytes(bytes: number[]): string {
  let escaped = '';
  for (const b of bytes) {
    escaped += (b < 16 ? '%0' : '%') + b.toString(16);
  }
  return decodeURIComponent(escaped);
}

function base64UrlEncode(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += ALPHABET[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += ALPHABET[n & 63];
  }
  return out;
}

function base64UrlDecode(str: string): number[] {
  const clean = str.replace(/=+$/, '');
  if (clean.length % 4 === 1) {
    throw new Error('bad length');
  }
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v === -1) {
      throw new Error('bad character');
    }
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  return bytes;
}

/**
 * Encodes sort-key values into an opaque, URL-safe cursor token.
 *
 * Cursors are encoded, not encrypted or signed: clients can read and alter them.
 * Their values are always bound as query parameters, never spliced into SQL.
 *
 * @example
 * encodeCursor({ createdAt: new Date('2024-01-01'), id: 42 }); // 'eyJjcmVhdGVkQXQiOn...'
 */
export function encodeCursor(values: Record<string, any>): string {
  const tagged: Record<string, any> = {};
  for (const [key, value] of Object.entries(values)) {
    tagged[key] = value instanceof Date ? { [DATE_TAG]: value.toISOString() } : value;
  }
  return base64UrlEncode(toUtf8Bytes(JSON.stringify(tagged)));
}

/**
 * Decodes a cursor token produced by `encodeCursor()`.
 * @throws Error('Invalid cursor') if the token is malformed.
 */
export function decodeCursor(token: string): Record<string, any> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromUtf8Bytes(base64UrlDecode(token)));
  } catch {
    throw new Error('Invalid cursor');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid cursor');
  }

  const values: Record<string, any> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, any>)) {
    if (
      value &&
      typeof value === 'object' &&
      Object.keys(value).length === 1 &&
      typeof value[DATE_TAG] === 'string'
    ) {
      values[key] = new Date(value[DATE_TAG]);
    } else {
      values[key] = value;
    }
  }
  return values;
}
