import { describe, it, expect } from 'vitest';
import * as privacy from './privacy';
import * as terms from './terms';

// These files are long hand-written strings - a stray apostrophe breaks the
// whole site's build, so make the tests catch it too.
describe('legal content', () => {
  it('Privacy Policy and Terms load and have sections', () => {
    for (const mod of [privacy, terms]) {
      const sections = Object.values(mod).find((v) => Array.isArray(v) || Array.isArray(v?.sections));
      expect(sections).toBeTruthy();
    }
  });
});
