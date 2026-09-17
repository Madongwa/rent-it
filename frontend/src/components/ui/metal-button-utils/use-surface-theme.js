import { useEffect, useState } from 'react';

// "auto" here means something different from metal-fx's own "auto": metal-fx
// only ever checks the OS's prefers-color-scheme. This app has no shadcn-style
// `.dark`/`.light` class toggle anywhere (grepped the codebase - there's no
// theme switcher; dark pages just hardcode `bg-night-bg` etc. per-component),
// so the class-detection branch below is dead code in practice today, kept
// only so this resolves correctly if a real class-based toggle gets added
// later. Until then, callers who know their surface is unconditionally dark
// (like the navbar) should pass theme="dark" directly rather than "auto" -
// "auto" would otherwise follow the visitor's OS setting, which has nothing
// to do with our navbar's own always-dark glass background.
function resolveFromDom() {
  const root = document.documentElement;
  if (root.classList.contains('dark')) return 'dark';
  if (root.classList.contains('light')) return 'light';
  return null;
}

export function useSurfaceTheme(theme = 'auto') {
  const [resolved, setResolved] = useState(() => {
    if (theme !== 'auto') return theme;
    if (typeof document === 'undefined') return 'dark';
    return (
      resolveFromDom() ||
      (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    );
  });

  useEffect(() => {
    if (theme !== 'auto') {
      setResolved(theme);
      return;
    }

    function recompute() {
      setResolved(
        resolveFromDom() ||
          (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      );
    }

    recompute();

    const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
    mql?.addEventListener('change', recompute);

    const observer = new MutationObserver(recompute);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      mql?.removeEventListener('change', recompute);
      observer.disconnect();
    };
  }, [theme]);

  return resolved;
}

export default useSurfaceTheme;
