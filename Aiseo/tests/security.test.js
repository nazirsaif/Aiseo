/**
 * Security Tests — SSRF protection
 * Tests the isSafeUrl function extracted for testability.
 * Run: node --test tests/security.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Inline the isSafeUrl function so it can be tested independently.
 * This mirrors the implementation in server.js exactly.
 */
function isSafeUrl(urlString) {
  try {
    if (urlString.includes('://') &&
        !urlString.startsWith('http://') &&
        !urlString.startsWith('https://')) {
      return false;
    }

    const urlToParse = urlString.startsWith('http') ? urlString : `https://${urlString}`;
    const url = new URL(urlToParse);

    if (!['http:', 'https:'].includes(url.protocol)) return false;

    const host = url.hostname.toLowerCase();

    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;

    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [, a, b] = ipv4.map(Number);
      if (a === 10)                          return false;
      if (a === 172 && b >= 16 && b <= 31)   return false;
      if (a === 192 && b === 168)             return false;
      if (a === 169 && b === 254)             return false;
      if (a === 0)                            return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ─── Blocked URLs (SSRF targets) ─────────────────────────────────────────────

describe('isSafeUrl — blocked URLs', () => {
  const blocked = [
    ['localhost', 'localhost'],
    ['127.0.0.1', 'IPv4 loopback'],
    ['http://127.0.0.1', 'IPv4 loopback with protocol'],
    ['http://127.0.0.1:8080/admin', 'loopback with port and path'],
    ['::1', 'IPv6 loopback'],
    ['10.0.0.1', 'private 10.x.x.x'],
    ['10.255.255.255', 'private 10.x.x.x upper'],
    ['172.16.0.1', 'private 172.16.x.x'],
    ['172.31.255.255', 'private 172.31.x.x upper'],
    ['192.168.1.1', 'private 192.168.x.x'],
    ['192.168.0.254', 'private 192.168.x.x'],
    ['169.254.0.1', 'link-local'],
    ['0.0.0.1', '0.x.x.x'],
    ['file:///etc/passwd', 'file protocol'],
    ['ftp://internal', 'ftp protocol'],
  ];

  blocked.forEach(([url, label]) => {
    test(`blocks ${label} (${url})`, () => {
      assert.equal(isSafeUrl(url), false,
        `Expected isSafeUrl("${url}") to return false`);
    });
  });
});

// ─── Allowed URLs ─────────────────────────────────────────────────────────────

describe('isSafeUrl — allowed URLs', () => {
  const allowed = [
    'https://www.google.com',
    'http://example.com',
    'https://example.com/path/to/page',
    'https://sub.domain.co.uk/page?q=test',
    'https://8.8.8.8',         // public IP (Google DNS)
    'https://1.1.1.1',         // public IP (Cloudflare)
    '172.15.0.1',              // just outside private range
    '172.32.0.1',              // just outside private range
    'example.com',             // no protocol — gets https:// prepended
  ];

  allowed.forEach(url => {
    test(`allows ${url}`, () => {
      assert.equal(isSafeUrl(url), true,
        `Expected isSafeUrl("${url}") to return true`);
    });
  });
});

// ─── Malformed URLs ───────────────────────────────────────────────────────────

describe('isSafeUrl — malformed input', () => {
  test('returns false for empty string', () => {
    assert.equal(isSafeUrl(''), false);
  });

  test('returns false for random garbage string', () => {
    assert.equal(isSafeUrl('not a url !!!'), false);
  });

  test('does not throw for null-like input', () => {
    assert.doesNotThrow(() => isSafeUrl('null'));
    assert.doesNotThrow(() => isSafeUrl('undefined'));
  });
});
