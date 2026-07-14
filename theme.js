(() => {
  const storageKey = "archivist-theme";
  const choices = new Set(["light", "dark"]);
  const saved = localStorage.getItem(storageKey);

  document.documentElement.dataset.theme = choices.has(saved) ? saved : "dark";

  const syncControls = () => {
    const selected = choices.has(document.documentElement.dataset.theme)
      ? document.documentElement.dataset.theme
      : "dark";

    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      const choice = button.dataset.themeChoice;
      const active = choice === selected;
      button.setAttribute("aria-pressed", String(active));
      button.title = active ? `Using ${choice} theme` : `Use ${choice} theme`;
    });

    document.querySelectorAll("[data-theme-toggle]").forEach((group) => {
      group.dataset.themeMode = selected;
      group.setAttribute(
        "aria-label",
        `Colour theme: ${selected}`
      );
    });
  };

  const selectTheme = (choice) => {
    document.documentElement.dataset.theme = choice;
    localStorage.setItem(storageKey, choice);
    syncControls();
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.addEventListener("click", () => selectTheme(button.dataset.themeChoice));
    });
    syncControls();
  });
})();
