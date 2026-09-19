// Loads Razorpay's Checkout.js on demand rather than on every page load -
// most visitors never open a payment, so there's no reason to fetch a
// third-party script for all of them. Cached as a module-level promise so
// a second "Pay now" click reuses the same load instead of re-fetching.
let loadPromise = null;

export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Could not load the payment provider - check your connection and try again.'));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}
