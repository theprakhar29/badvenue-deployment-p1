let loadPromise = null;

/**
 * Loads Razorpay's Checkout script on demand (not in index.html) so pages
 * that never take a payment don't pay the cost of loading it. Cached so
 * repeated calls don't inject the script twice.
 */
export function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Couldn't load the payment form. Check your connection and try again."));
    document.body.appendChild(script);
  });

  return loadPromise;
}
