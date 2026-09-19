import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DarkGradientBg } from './elegant-dark-pattern.jsx';

describe('DarkGradientBg', () => {
  it('renders its children', () => {
    render(
      <DarkGradientBg>
        <p>page content</p>
      </DarkGradientBg>
    );
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('applies a caller-provided className instead of silently dropping it', () => {
    // Regression test: the original pasted component destructured
    // `className` but never applied it to the outer div, so a page's
    // `min-h-[calc(100vh-4rem)]` override was a no-op - fixed with
    // cn(defaults, className). This guards against that regressing.
    const { container } = render(
      <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
        <p>content</p>
      </DarkGradientBg>
    );
    const outer = container.firstChild;
    expect(outer.className).toContain('min-h-[calc(100vh-4rem)]');
    // The default min-h-screen should be gone (overridden), not just
    // appended alongside a conflicting value.
    expect(outer.className).not.toContain('min-h-screen');
  });

  it('falls back to the default min-h-screen when no className is given', () => {
    const { container } = render(<DarkGradientBg>content</DarkGradientBg>);
    expect(container.firstChild.className).toContain('min-h-screen');
  });
});
