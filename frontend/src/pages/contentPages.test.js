import { describe, it, expect } from 'vitest';

// Home, How It Works and Help are mostly long hand-written text - a stray
// quote in them breaks the site's build. Loading them here makes the tests
// catch it first.
describe('content pages', () => {
  it('load', async () => {
    for (const load of [() => import('./Home'), () => import('./HowItWorks'), () => import('./Help')]) {
      const mod = await load();
      expect(typeof mod.default).toBe('function');
    }
    // Importing Home pulls in the animation libraries - slow on a cold run.
  }, 60000);
});
