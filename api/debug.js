module.exports = async function handler(req, res) {
  const redisUrl = process.env.REDIS_URL || '';

  let parsed = null;
  try {
    const u = new URL(redisUrl);
    parsed = {
      protocol: u.protocol,
      hostname: u.hostname,
      port:     u.port,
      username: u.username,
      hasPassword: !!u.password,
      restUrl:  `https://${u.hostname}`,
    };
  } catch (e) {
    parsed = { parseError: e.message };
  }

  let pingResult = 'not attempted';
  if (parsed && parsed.restUrl && !parsed.parseError) {
    try {
      const u = new URL(redisUrl);
      const r = await fetch(parsed.restUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${u.password}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['PING']),
      });
      const text = await r.text();
      pingResult = `HTTP ${r.status}: ${text}`;
    } catch (e) {
      pingResult = `fetch error: ${e.message}`;
    }
  }

  res.json({
    hasRedisUrl:       !!process.env.REDIS_URL,
    hasKvRestApiUrl:   !!process.env.KV_REST_API_URL,
    hasKvRestApiToken: !!process.env.KV_REST_API_TOKEN,
    parsed,
    pingResult,
  });
};
