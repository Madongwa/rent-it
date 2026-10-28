// Server errors (status 500+) often carry raw database text - table and
// column names, constraint names - that means nothing to a user and tells
// an attacker about the schema. This swaps the `error` of any 5xx JSON
// response for a plain message and logs the real one. Staff routes keep the
// real message (it helps staff). 502s are the AI features' own
// friendly "busy right now" messages and 503 is maintenance mode, so
// they're left alone.
export const GENERIC_ERROR = 'Something went wrong on our side - please try again.';

export function hideServerErrors(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    const staff = req.originalUrl.startsWith('/api/admin');
    if (res.statusCode >= 500 && ![502, 503].includes(res.statusCode) && !staff && body && typeof body.error === 'string') {
      if (body.error !== GENERIC_ERROR) console.error(`[api] ${req.method} ${req.originalUrl} -> ${res.statusCode}:`, body.error);
      return json({ ...body, error: GENERIC_ERROR });
    }
    return json(body);
  };
  next();
}
