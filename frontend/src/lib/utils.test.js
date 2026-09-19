import { describe, it, expect } from 'vitest';
import { cn } from './utils.js';

describe('cn', () => {
  it('joins plain class strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values (the common conditional-class pattern)', () => {
    expect(cn('a', false && 'b', null, undefined, '', 'c')).toBe('a c');
  });

  it('resolves conflicting Tailwind utilities to the last one wins', () => {
    // This is the entire reason to use tailwind-merge instead of a plain
    // join: 'px-2 px-4' would otherwise ship both classes and let CSS
    // source order (not intent) decide which wins.
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-night-muted', 'text-night-text')).toBe('text-night-text');
  });

  it('merges non-conflicting classes from conditional objects/arrays', () => {
    expect(cn('base', ['a', 'b'], { active: true, hidden: false })).toBe('base a b active');
  });
});
