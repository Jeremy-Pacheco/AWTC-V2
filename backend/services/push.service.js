/**
 * Web Push endpoint checks (AUDIT_REPORT.md, SEC-20 / SEC-21).
 *
 * The server POSTs every notification to the subscription endpoint, so an
 * arbitrary URL would let a user make the server call internal or third-party
 * addresses (SSRF). Only the browsers' push services are accepted:
 *   Chrome / Edge (Chromium) / Opera / Brave / Samsung -> fcm.googleapis.com
 *   Firefox                                            -> *.push.services.mozilla.com
 *   Safari                                             -> *.push.apple.com
 *   Edge (legacy, WNS)                                 -> *.notify.windows.com
 * PUSH_ALLOWED_HOSTS (comma-separated) adds hosts; "*.example.com" allows subdomains.
 */
const DEFAULT_ALLOWED_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  '*.push.services.mozilla.com',
  '*.push.apple.com',
  '*.notify.windows.com',
];

function allowedHostPatterns() {
  const extra = String(process.env.PUSH_ALLOWED_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_HOSTS, ...extra];
}

function hostMatches(hostname, pattern) {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // ".push.apple.com"
    return hostname.endsWith(suffix) && hostname.length > suffix.length;
  }
  return hostname === pattern;
}

/** True only for https URLs on the default port of an allowed push service. */
function isAllowedPushEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return false;
  const hostname = url.hostname.toLowerCase();
  return allowedHostPatterns().some((pattern) => hostMatches(hostname, pattern));
}

/**
 * Proof of possession for an existing endpoint (SEC-21): the browser that
 * owns a push subscription knows its keys; someone who only learned the
 * endpoint URL does not.
 */
function sameKeys(storedKeys, submittedKeys) {
  let stored = storedKeys;
  if (typeof stored === 'string') {
    try {
      stored = JSON.parse(stored);
    } catch {
      return false;
    }
  }
  return Boolean(stored && submittedKeys)
    && stored.p256dh === submittedKeys.p256dh
    && stored.auth === submittedKeys.auth;
}

/** Host of an endpoint for logs (the full URL works as a capability: never log it). */
function endpointHost(endpoint) {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return 'invalid-endpoint';
  }
}

module.exports = { isAllowedPushEndpoint, sameKeys, endpointHost, DEFAULT_ALLOWED_HOSTS };
