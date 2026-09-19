import { describe, it, expect, beforeEach, vi } from 'vitest';

// loadRazorpay.js caches its promise at module scope (so a second "Pay now"
// click reuses the in-flight load), which means the module itself must be
// re-imported fresh per test - otherwise state leaks between cases.
async function freshModule() {
  vi.resetModules();
  return import('./loadRazorpay.js');
}

describe('loadRazorpayCheckout', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.Razorpay;
  });

  it('injects the Razorpay checkout script exactly once and resolves on load', async () => {
    const { loadRazorpayCheckout } = await freshModule();

    const promise = loadRazorpayCheckout();
    const script = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    expect(script).not.toBeNull();

    // Simulate the real script finishing load and attaching the global,
    // exactly as checkout.js does in a browser.
    window.Razorpay = function FakeRazorpay() {};
    script.onload();

    await expect(promise).resolves.toBe(window.Razorpay);

    // A second call while nothing changed should reuse window.Razorpay
    // rather than injecting another <script> tag.
    await loadRazorpayCheckout();
    expect(document.querySelectorAll('script[src*="checkout.razorpay.com"]').length).toBe(1);
  });

  it('rejects with a friendly error and allows retrying when the script fails to load', async () => {
    const { loadRazorpayCheckout } = await freshModule();

    const firstAttempt = loadRazorpayCheckout();
    const script = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    script.onerror();

    await expect(firstAttempt).rejects.toThrow(/could not load the payment provider/i);

    // Failure clears the cached promise, so a retry injects a fresh script
    // instead of returning the same rejected promise forever.
    const secondAttempt = loadRazorpayCheckout();
    const secondScript = document.querySelectorAll('script[src*="checkout.razorpay.com"]')[1];
    expect(secondScript).not.toBeUndefined();
    window.Razorpay = function FakeRazorpay() {};
    secondScript.onload();
    await expect(secondAttempt).resolves.toBe(window.Razorpay);
  });

  it('resolves immediately without injecting a script if Razorpay is already loaded', async () => {
    window.Razorpay = function FakeRazorpay() {};
    const { loadRazorpayCheckout } = await freshModule();

    await expect(loadRazorpayCheckout()).resolves.toBe(window.Razorpay);
    expect(document.querySelector('script[src*="checkout.razorpay.com"]')).toBeNull();
  });
});
