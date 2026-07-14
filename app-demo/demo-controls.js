const desktopOnlyControls = document.querySelectorAll([
  '[data-view="launch"]',
  '[data-view="verify"]',
  '#openEmulators',
  '#openSettings',
  '#openAbout',
  '.window-button',
  '[data-mode="games"]',
  '[data-mode="network"]',
  '#exploreOrderButton',
  '#launchTitles',
  '#verifyTitles'
].join(','));

desktopOnlyControls.forEach(button => {
  button.dataset.disabledTooltip = "Available in the desktop app";
  button.title = "Available in the desktop app";
  button.classList.add("has-disabled-callout");
  const callout = document.createElement("span");
  callout.className = "disabled-callout";
  callout.textContent = "Available in the desktop app";
  callout.setAttribute("aria-hidden", "true");
  button.append(callout);
  button.disabled = true;
  button.setAttribute("aria-disabled", "true");
});

const themeDemoControlSelector = [
  "#settingAppTheme",
  "#settingLightColourScheme",
  "#settingDarkColourScheme",
  "#settingLightMinimumContrast",
  "#settingDarkMinimumContrast"
].join(",");

function setUpThemeDemo() {
  document.body.classList.add("themes-demo");
  openSettings();

  const modal = document.querySelector("#settingsModal");
  setAppSetting("appTheme", "dark");
  ["Light", "Dark"].forEach((theme) => {
    const contrast = document.querySelector(`#setting${theme}MinimumContrast`);
    const scheme = document.querySelector(`#setting${theme}ColourScheme`);
    if (contrast.disabled) {
      const fallback = [...scheme.options].find((option) => option.value !== "archivist" && option.value !== "custom");
      if (fallback) setAppColourScheme(theme.toLowerCase(), fallback.value);
    }
    setMinimumContrast(theme.toLowerCase(), true);
  });
  const allowedControls = [...modal.querySelectorAll(themeDemoControlSelector)];
  modal.querySelectorAll("button, input, select").forEach((control) => {
    const allowed = allowedControls.includes(control);
    control.disabled = !allowed;
    if (allowed) control.closest(".settings-row")?.classList.add("theme-demo-allowed");
  });
  const settingsList = modal.querySelector(".settings-list");
  const firstThemeRow = allowedControls[0]?.closest(".settings-row");
  settingsList.scrollTop = Math.max(0, firstThemeRow.offsetTop - settingsList.offsetTop - 8);
  const eventIsAllowed = (event) => event.target.closest?.(".theme-demo-allowed");
  ["pointerdown", "click", "dblclick", "contextmenu", "wheel"].forEach((type) => {
    document.addEventListener(type, (event) => {
      if (eventIsAllowed(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true, passive: false });
  });
  document.addEventListener("keydown", (event) => {
    if (eventIsAllowed(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  let idleTimer;
  let cycleTimer;
  const cycleScheme = () => {
    const theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    const polarity = document.querySelector("#settingAppTheme");
    polarity.value = theme;
    polarity.dispatchEvent(new Event("change", { bubbles: true }));
    const select = document.querySelector(`#setting${theme === "light" ? "Light" : "Dark"}ColourScheme`);
    const schemes = [...select.options]
      .map((option) => option.value)
      .filter((value) => value !== "archivist" && value !== "custom");
    if (schemes.length < 2) return;
    select.value = schemes[(Math.max(0, schemes.indexOf(select.value)) + 1) % schemes.length];
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const scheduleCycling = () => {
    clearTimeout(idleTimer);
    clearInterval(cycleTimer);
    idleTimer = setTimeout(() => {
      cycleScheme();
      cycleTimer = setInterval(cycleScheme, 2000);
    }, 5000);
  };
  allowedControls.forEach((control) => control.addEventListener("change", (event) => {
    const userChange = event.isTrusted || window.__ARCHIVIST_THEME_DEMO_GAMEPAD_CHANGE;
    window.__ARCHIVIST_THEME_DEMO_GAMEPAD_CHANGE = false;
    if (userChange) scheduleCycling();
  }));
  scheduleCycling();
}

let demoViewInitialized = false;

function initializeDemoView() {
  if (demoViewInitialized) return;
  demoViewInitialized = true;
  if (demoView === "emulators") {
    document.body.classList.add("emulators-demo");
    const modal = document.querySelector("#emulatorsModal");
    modal.hidden = false;
    document.querySelector("#openEmulators").setAttribute("aria-expanded", "true");
    const populate = window.setInterval(() => {
      renderEmulatorProfiles();
      if (document.querySelector("#emulatorProfiles").children.length) window.clearInterval(populate);
    }, 50);
  }
  if (demoView === "themes") setUpThemeDemo();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeDemoView, { once: true });
} else {
  initializeDemoView();
}
window.addEventListener("load", initializeDemoView, { once: true });
