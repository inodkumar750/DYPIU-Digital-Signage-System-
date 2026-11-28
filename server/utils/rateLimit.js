/** Tiny in-memory fixed-window limiter (single-process deployment). */
export function createLimiter({ windowMs, max }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs);
  timer.unref?.();

  return {
    /** Returns remaining seconds to wait if blocked, otherwise 0. */
    peek(key) {
      const v = hits.get(key);
      if (!v || v.reset <= Date.now()) return 0;
      return v.count >= max ? Math.ceil((v.reset - Date.now()) / 1000) : 0;
    },
    hit(key) {
      const now = Date.now();
      const v = hits.get(key);
      if (!v || v.reset <= now) hits.set(key, { count: 1, reset: now + windowMs });
      else v.count += 1;
    },
    clear(key) {
      hits.delete(key);
    },
  };
}

export function rateLimitMiddleware(opts) {
  const limiter = createLimiter(opts);
  return (req, res, next) => {
    const key = req.ip;
    const wait = limiter.peek(key);
    if (wait > 0) {
      res.set('Retry-After', String(wait));
      return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
    }
    limiter.hit(key);
    next();
  };
}
