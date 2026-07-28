(() => {
  "use strict";

  const storageKey = "archivist.signup-attribution.v1";
  const featureEndpoint =
    "https://xbwhevdunxftierqlpsr.supabase.co/functions/v1/record-pro-feature";
  const slugPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const root = document.documentElement;
  const sourcePage = root.dataset.signupSource;
  const proFeatures = (root.dataset.proFeatures ?? "")
    .split(/\s+/)
    .filter((feature) => slugPattern.test(feature));
  const previewFeature = new URLSearchParams(window.location.search).get(
    "feature",
  );
  const isPreview = proFeatures.includes(previewFeature);
  const isSlug = (value) =>
    typeof value === "string" && slugPattern.test(value);

  const isAttribution = (value) =>
    value &&
    typeof value.subjectId === "string" &&
    Array.isArray(value.sourcePages) &&
    value.sourcePages.length > 0 &&
    value.sourcePages.length <= 16 &&
    value.sourcePages.every(isSlug) &&
    new Set(value.sourcePages).size === value.sourcePages.length &&
    (
      value.proFirstFeature === null ||
      isSlug(value.proFirstFeature)
    );

  const readStoredAttribution = () => {
    try {
      const value = JSON.parse(window.localStorage.getItem(storageKey));
      if (
        value &&
        typeof value.subjectId === "string" &&
        isSlug(value.sourcePage)
      ) {
        value.sourcePages = [value.sourcePage];
        delete value.sourcePage;
      }
      return isAttribution(value) ? value : null;
    } catch {
      return null;
    }
  };

  const chooseFeature = () => {
    if (proFeatures.length === 0) return null;
    const random = new Uint32Array(1);
    window.crypto.getRandomValues(random);
    return proFeatures[random[0] % proFeatures.length];
  };

  const stored = readStoredAttribution();
  const attribution = {
    subjectId: stored?.subjectId ?? window.crypto.randomUUID(),
    sourcePages: stored?.sourcePages ?? ["direct"],
    proFirstFeature: stored?.proFirstFeature ??
      (proFeatures.length > 0 ? chooseFeature() : null),
  };

  const persist = () => {
    if (isPreview) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(attribution));
    } catch {
      // Signup still works for this page view when storage is unavailable.
    }
  };

  const recordSource = (source) => {
    if (
      isPreview || !isSlug(source) || attribution.sourcePages.includes(source)
    ) {
      return false;
    }
    const retainedSources = attribution.sourcePages.filter((value) =>
      value !== "direct"
    );
    if (retainedSources.length >= 16) return false;
    attribution.sourcePages = [...retainedSources, source];
    persist();
    window.dispatchEvent(new CustomEvent("archivist:signup-attribution"));
    return true;
  };

  if (isSlug(sourcePage)) recordSource(sourcePage);
  else persist();

  const displayedFeature = isPreview
    ? previewFeature
    : attribution.proFirstFeature;
  if (displayedFeature && proFeatures.includes(displayedFeature)) {
    root.dataset.proFirstFeature = displayedFeature;
  }

  window.ArchivistSignupAttribution = {
    value: isPreview ? null : attribution,
    recordSource,
  };

  if (!isPreview && proFeatures.length > 0 && attribution.proFirstFeature) {
    fetch(featureEndpoint, {
      method: "POST",
      mode: "cors",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject_id: attribution.subjectId,
        first_feature: attribution.proFirstFeature,
      }),
    }).catch(() => {
      // Measurement must never interrupt the page.
    });
  }
})();
