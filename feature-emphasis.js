(() => {
  "use strict";

  const emphasisKey = "pro-benefit-emphasis-v1";
  const storageKey = `archivist.feature-emphasis.${emphasisKey}`;
  const endpoint =
    "https://xbwhevdunxftierqlpsr.supabase.co/functions/v1/record-feature-emphasis";
  const features = new Set(["canon", "atlas"]);
  const isFeaturePage = /^\/pro(?:\.html)?\/?$/.test(window.location.pathname);
  const previewFeature = new URLSearchParams(window.location.search).get(
    "feature",
  );

  const isAssignment = (value) =>
    value &&
    typeof value.subjectId === "string" &&
    features.has(value.initialFeature);

  const readStoredAssignment = () => {
    try {
      const value = JSON.parse(window.localStorage.getItem(storageKey));
      return isAssignment(value) ? value : null;
    } catch {
      return null;
    }
  };

  const createAssignment = () => {
    const random = new Uint8Array(1);
    window.crypto.getRandomValues(random);
    return {
      subjectId: window.crypto.randomUUID(),
      initialFeature: random[0] % 2 === 0 ? "canon" : "atlas",
    };
  };

  const persistAssignment = (value) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // The page still works when storage is unavailable.
    }
  };

  const storedAssignment = readStoredAssignment();
  const isPreview = isFeaturePage && features.has(previewFeature);
  const assignment = isPreview
    ? { subjectId: null, initialFeature: previewFeature }
    : storedAssignment ?? (isFeaturePage ? createAssignment() : null);

  if (!isPreview && !storedAssignment && assignment) {
    persistAssignment(assignment);
  }

  if (assignment && isFeaturePage) {
    document.documentElement.dataset.featureEmphasis =
      assignment.initialFeature;
  }

  const record = (selectedFeature = null) => {
    if (isPreview || !assignment?.subjectId) return;
    const body = {
      emphasis_key: emphasisKey,
      subject_id: assignment.subjectId,
      initial_feature: assignment.initialFeature,
    };
    if (selectedFeature) {
      body.event_id = window.crypto.randomUUID();
      body.selected_feature = selectedFeature;
    }
    fetch(endpoint, {
      method: "POST",
      mode: "cors",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {
      // Measurement must never interrupt the page.
    });
  };

  const showFeature = (feature) => {
    if (!features.has(feature)) return;
    document.documentElement.dataset.featureEmphasis = feature;
    document.querySelectorAll("[data-emphasize-feature]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.emphasizeFeature === feature),
      );
    });
  };

  window.ArchivistFeatureEmphasis = {
    assignment: isPreview ? null : assignment,
  };

  const initialize = () => {
    if (!assignment || !isFeaturePage) return;
    showFeature(assignment.initialFeature);
    document.querySelectorAll("[data-emphasize-feature]").forEach((button) => {
      button.addEventListener("click", () => {
        const feature = button.dataset.emphasizeFeature;
        showFeature(feature);
        record(feature);
      });
    });
    record();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
