const axios = require('axios');

/**
 * Proxy for the public Volunteer Connector API.
 *
 * TLS certificates are verified (Node's default). The former agent
 * disabled certificate checks, which let anyone on the network path
 * impersonate the API (SEC-22); the site has a valid certificate.
 */
const VOLUNTEER_CONNECTOR_URL = 'https://www.volunteerconnector.org/api/search/';
const REQUEST_TIMEOUT_MS = 10 * 1000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const CACHE_TTL_MS = 5 * 60 * 1000;

const http = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  maxContentLength: MAX_RESPONSE_BYTES,
  maxRedirects: 3,
  headers: {
    // Identify ourselves honestly instead of impersonating a browser
    'User-Agent': 'AWTC/1.0 (volunteering platform)',
    Accept: 'application/json',
  },
});

// Small in-memory cache: the listing changes slowly and every page view
// would otherwise hit the external API (and wait for it).
let cache = { data: null, expires: 0 };

exports.getVolunteerOpportunities = async (req, res) => {
  if (cache.data && Date.now() < cache.expires) {
    return res.status(200).json(cache.data);
  }
  try {
    const response = await http.get(VOLUNTEER_CONNECTOR_URL);
    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Unexpected response format');
    }
    cache = { data: response.data, expires: Date.now() + CACHE_TTL_MS };
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching external opportunities:', error.code || '', error.message);
    // Serve stale data rather than nothing if the API is briefly unavailable
    if (cache.data) return res.status(200).json(cache.data);
    res.status(502).json({ message: 'Error fetching external opportunities' });
  }
};

// Exposed for tests
exports._http = http;
exports._resetCache = () => { cache = { data: null, expires: 0 }; };
