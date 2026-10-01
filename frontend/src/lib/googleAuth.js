// Google sign-in (Supabase OAuth). The button only shows once Google is
// switched on in the Supabase dashboard - read from the project's public
// auth settings - so the live site never offers a button that can't work.

const AFTER_LOGIN_KEY = 'rentit.afterLogin';
let enabledPromise = null;

export function googleEnabled() {
  if (!enabledPromise) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    enabledPromise = !url || !key
      ? Promise.resolve(false)
      : fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
          .then((r) => (r.ok ? r.json() : {}))
          .then((s) => !!s.external?.google)
          .catch(() => false);
  }
  return enabledPromise;
}

// Where to go after Google sends the person back (kept for this tab only).
export function rememberAfterLogin(path) {
  try {
    if (path && path.startsWith('/') && !path.startsWith('//')) sessionStorage.setItem(AFTER_LOGIN_KEY, path);
  } catch {
    // storage blocked - they'll land on the Dashboard instead
  }
}

export function takeAfterLogin() {
  try {
    const path = sessionStorage.getItem(AFTER_LOGIN_KEY);
    sessionStorage.removeItem(AFTER_LOGIN_KEY);
    return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
  } catch {
    return null;
  }
}
