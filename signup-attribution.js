(() => {
  "use strict";

  const storageKey = "archivist.signup-attribution.v1";
  const slugPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const root = document.documentElement;
  const sourcePage = root.dataset.signupSource;
  const isSlug = (value) =>
    typeof value === "string" && slugPattern.test(value);

  const isAttribution = (value) =>
    value &&
    typeof value.subjectId === "string" &&
    Array.isArray(value.sourcePages) &&
    value.sourcePages.length > 0 &&
    value.sourcePages.length <= 16 &&
    value.sourcePages.every(isSlug) &&
    new Set(value.sourcePages).size === value.sourcePages.length;

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

  const stored = readStoredAttribution();
  const attribution = {
    subjectId: stored?.subjectId ?? window.crypto.randomUUID(),
    sourcePages: stored?.sourcePages ?? ["direct"],
  };

  const persist = () => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(attribution));
    } catch {
      // Signup still works for this page view when storage is unavailable.
    }
  };

  const recordSource = (source) => {
    if (
      !isSlug(source) || attribution.sourcePages.includes(source)
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

  window.ArchivistSignupAttribution = {
    value: attribution,
    recordSource,
  };
})();
