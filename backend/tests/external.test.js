// External volunteering API proxy (SEC-22: TLS verification)
const { describe, it, expect, beforeEach } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const controller = require('../controllers/external.controller');

const mockResponse = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.data = data; return res; };
  return res;
};

const SAMPLE = { count: 1, results: [{ id: 1, title: 'Beach clean-up' }] };

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  controller._resetCache();
});

describe('External opportunities proxy', () => {
  it('verifies TLS certificates (no custom agent disabling them)', () => {
    expect(controller._http.defaults.httpsAgent).toBeUndefined();
    const sources = ['controllers', 'config', 'services', 'utils']
      .flatMap((dir) => fs.readdirSync(path.join(__dirname, '..', dir)).map((f) => path.join(__dirname, '..', dir, f)))
      .filter((f) => f.endsWith('.js'))
      .map((f) => [f, fs.readFileSync(f, 'utf8')]);
    // Only the documented DB fallback (no CA configured) may skip verification
    const offenders = sources
      .filter(([f, code]) => /rejectUnauthorized:\s*false/.test(code) && !f.endsWith('sequelize.config.js'))
      .map(([f]) => path.basename(f));
    expect(offenders).toEqual([]);
  });

  it('uses a timeout, a response size limit and an honest User-Agent', () => {
    expect(controller._http.defaults.timeout).toBeGreaterThan(0);
    expect(controller._http.defaults.maxContentLength).toBeGreaterThan(0);
    expect(controller._http.defaults.headers['User-Agent']).toMatch(/^AWTC\//);
  });

  it('returns the API data and caches it', async () => {
    const get = jest.spyOn(controller._http, 'get').mockResolvedValue({ data: SAMPLE });
    const first = mockResponse();
    const second = mockResponse();

    await controller.getVolunteerOpportunities({}, first);
    await controller.getVolunteerOpportunities({}, second);

    expect(first.statusCode).toBe(200);
    expect(second.data).toEqual(SAMPLE);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('answers 502 without leaking details when the API fails and nothing is cached', async () => {
    jest.spyOn(controller._http, 'get').mockRejectedValue(Object.assign(new Error('self-signed certificate'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }));
    const res = mockResponse();

    await controller.getVolunteerOpportunities({}, res);

    expect(res.statusCode).toBe(502);
    expect(JSON.stringify(res.data)).not.toMatch(/certificate/);
  });

  it('serves stale cached data if a later refresh fails', async () => {
    jest.spyOn(controller._http, 'get').mockResolvedValueOnce({ data: SAMPLE });
    await controller.getVolunteerOpportunities({}, mockResponse());

    // Force expiry, then make the API fail
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 60 * 1000);
    controller._http.get.mockRejectedValueOnce(new Error('timeout'));
    const res = mockResponse();
    await controller.getVolunteerOpportunities({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.data).toEqual(SAMPLE);
  });

  it('rejects responses that are not JSON objects', async () => {
    jest.spyOn(controller._http, 'get').mockResolvedValue({ data: '<html>maintenance</html>' });
    const res = mockResponse();

    await controller.getVolunteerOpportunities({}, res);

    expect(res.statusCode).toBe(502);
  });
});
