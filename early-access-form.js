const TURNSTILE_SITE_KEY = "0x4AAAAAAD3HeGKnFCrJqPE7";

export function renderEarlyAccessChallenge(container, callback) {
  if (!window.turnstile) {
    throw new Error("Turnstile has not loaded");
  }
  return window.turnstile.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    action: "early-access",
    appearance: "interaction-only",
    callback,
    "error-callback": () => callback(null),
    "expired-callback": () => callback(null),
    theme: "auto",
  });
}

const form = document.querySelector(".signup-form");

if (form) {
  const challenge = form.querySelector("[data-early-access-challenge]");
  const submit = form.querySelector('button[type="submit"]');
  const status = form.querySelector("[data-early-access-status]");
  const idleMessage = "We’ll notify you when paid early access opens and again when Archivist Free is released. Unsubscribe anytime.";

  const setReady = (ready, message = idleMessage) => {
    submit.disabled = !ready;
    status.textContent = message;
  };

  const initialize = () => {
    try {
      renderEarlyAccessChallenge(challenge, (token) => {
        setReady(Boolean(token), token ? idleMessage : "Verification expired. Please try again.");
      });
    } catch (error) {
      console.error("Could not start early-access verification", error);
      setReady(false, "Verification didn’t load. Refresh the page to try again.");
    }
  };

  if (document.readyState === "complete") initialize();
  else window.addEventListener("load", initialize, { once: true });

  form.addEventListener("submit", () => {
    submit.disabled = true;
    submit.textContent = "Subscribing…";
    status.textContent = "Sending your confirmation email…";
  });
}
