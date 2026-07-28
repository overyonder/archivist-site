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
  const idleMessage = "Release emails cover paid early access, major availability changes and the Archivist Free release. Unsubscribe anytime.";

  const attribution = new URLSearchParams(window.location.search);
  const campaignFields = {
    campaign_source: "utm_source",
    campaign_medium: "utm_medium",
    campaign_name: "utm_campaign",
    campaign_content: "utm_content",
  };
  Object.entries(campaignFields).forEach(([fieldName, parameterName]) => {
    const field = form.elements.namedItem(fieldName);
    if (field) field.value = (attribution.get(parameterName) ?? "").slice(0, 100);
  });
  const landingPage = form.elements.namedItem("landing_page");
  if (landingPage) landingPage.value = window.location.pathname.slice(0, 200);
  const signupAttribution = window.ArchivistSignupAttribution?.value;
  if (signupAttribution) {
    const subjectId = form.elements.namedItem("attribution_subject_id");
    const signupSources = form.elements.namedItem("signup_sources");
    const proFirstFeature = form.elements.namedItem("pro_first_feature");
    if (subjectId) subjectId.value = signupAttribution.subjectId;
    if (signupSources) {
      signupSources.value = JSON.stringify(signupAttribution.sourcePages);
    }
    if (proFirstFeature) {
      proFirstFeature.value = signupAttribution.proFirstFeature ?? "";
    }
  }

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
