let systemTree = { root: [], nodes: {} };
const gameNodes = [];
const gameLinks = [];
const networkNodes = [];
const networkLinks = [];
let launchGames = [];

const initialTimelineDomain = { min: 1970, max: 2001 };
const demoView = new URLSearchParams(location.search).get("view") || "history";
const appSettingsKey = `archivist.demo.settings.${demoView}.v1`;
const appThemes = new Set(["system", "light", "dark"]);
const appColourFields = [
  { key: "bg", css: "--bg", label: "Background" },
  { key: "panel", css: "--panel", label: "Panel" },
  { key: "panel2", css: "--panel-2", label: "Panel 2" },
  { key: "line", css: "--line", label: "Line" },
  { key: "accent", css: "--accent", label: "Accent" },
  { key: "accentHi", css: "--accent-hi", label: "Accent high" },
  { key: "accentTop", css: "--accent-top", label: "Accent top" },
  { key: "accentBottom", css: "--accent-bottom", label: "Accent bottom" },
  { key: "text", css: "--text", label: "Text" },
  { key: "muted", css: "--muted", label: "Muted text" },
  { key: "dim", css: "--dim", label: "Dim text" },
  { key: "green", css: "--green", label: "Green" },
  { key: "red", css: "--red", label: "Red" },
  { key: "blue", css: "--blue", label: "Blue" },
  { key: "pink", css: "--pink", label: "Pink" },
  { key: "onAccent", css: "--on-accent", label: "On accent" },
  { key: "strongText", css: "--strong-text", label: "Strong text" },
  { key: "titlebarBg", css: "--titlebar-bg", label: "Titlebar" },
  { key: "accentSurface", css: "--accent-surface", label: "Accent surface" },
  { key: "dangerSurface", css: "--danger-surface", label: "Danger surface" },
  { key: "controlBg", css: "--control-bg", label: "Control" },
  { key: "rangeLine", css: "--range-line", label: "Range line" },
  { key: "canvasNode", css: "--canvas-node", label: "Canvas node" },
  { key: "canvasNodeCollapsed", css: "--canvas-node-collapsed", label: "Canvas node collapsed" },
  { key: "canvasNodeBorder", css: "--canvas-node-border", label: "Canvas node border" },
  { key: "canvasNodeBorderCollapsed", css: "--canvas-node-border-collapsed", label: "Canvas collapsed border" },
  { key: "canvasText", css: "--canvas-text", label: "Canvas text" },
  { key: "canvasMuted", css: "--canvas-muted", label: "Canvas muted" },
  { key: "canvasGrid", css: "--canvas-grid", label: "Canvas grid" },
  { key: "canvasGridMinor", css: "--canvas-grid-minor", label: "Canvas grid minor" },
  { key: "canvasAxis", css: "--canvas-axis", label: "Canvas axis" },
  { key: "canvasAxisText", css: "--canvas-axis-text", label: "Canvas axis text" },
  { key: "canvasRow", css: "--canvas-row", label: "Canvas row" },
  { key: "canvasDot", css: "--canvas-dot", label: "Canvas dot", alpha: { dark: .08, light: .13 } },
  { key: "canvasLink", css: "--canvas-link", label: "Canvas link" },
  { key: "canvasGlow", css: "--canvas-glow", label: "Canvas glow", alpha: { dark: .72, light: .46 } }
];
const derivedColourVars = ["--accent-rgb", "--blue-rgb", "--surface-rgb", "--shadow-rgb", "--highlight-rgb"];
const base16Schemes = window.BASE16_SCHEMES || {};
const minUiContrastRatio = 8;
const legacyColourSchemes = {
  light: {
    catppuccin: "catppuccin-latte",
    gruvbox: "gruvbox-light-medium",
    nord: "nord",
    solarized: "solarized-light",
    "tokyo-night": "tokyo-night-light"
  },
  dark: {
    catppuccin: "catppuccin-mocha",
    gruvbox: "gruvbox-dark-medium",
    nord: "nord",
    solarized: "solarized-dark",
    "tokyo-night": "tokyo-night-dark"
  }
};
const defaultAppSettings = {
  appTheme: "dark",
  lightColourScheme: "archivist",
  darkColourScheme: "archivist",
  lightMinimumContrast: false,
  darkMinimumContrast: false,
  customColours: { light: {}, dark: {} },
  launchOnStartup: false,
  minimizeToTray: true,
  closeToTray: false
};

const state = {
  view: "explore",
  mode: "systems",
  subject: "systems",
  layout: "timeline",
  selected: null,
  open: new Set(),
  order: "first-release",
  showLamps: true,
  timelineDensity: .5,
  yearMin: initialTimelineDomain.min,
  yearMax: initialTimelineDomain.max,
  launchSystem: null,
  launchGame: null,
  launchPort: null,
  launchQuery: "",
  launchPlayableOnly: false,
  launchGroup: "system",
  launchOrder: "oldest",
  launchCabinetScroll: false,
  launchBoxSize: 126,
  launchSystemQuery: "",
  launchDrawerOpen: true,
  verifyNode: null,
  verifyManifest: null,
  verifyOpenNodes: new Set(["all-manifests"]),
  verifyManifestFilter: "selected",
  verifyQuery: "",
  verifyReleaseFilter: "all",
  verifyStage: "artifacts",
  intakePath: "",
  organizerStage: "unscanned",
  dragThumb: null,
  canvasDrag: null,
  appSettings: loadAppSettings(),
  dragStartX: 0,
  dragStartY: 0,
  dragStartMin: 0,
  dragStartMax: 0
};

let systems = [];
let desiredTitles = [];
let manifestSelections = [];
let vaultFiles = [];
let systemTitles = new Map();
let systemTitleNames = new Map();
let systemManifests = new Map();
let systemVault = new Map();
let systemVaultTitles = new Map();
let manifestSources = [];
let manifestSourcesStatus = "idle";
let manifestReleaseCache = new Map();
let manifestReleasePromises = new Map();
let manifestReleaseStatus = "idle";
let verifyManifests = new Map();
let verifySources = new Map();
let verifySystemCounts = new Map();
let verifySelectionCounts = new Map();
let verifyReleaseLists = new Map();
let verifyIndexDirty = true;
let verifyTreeDirty = true;
let verifyContentDirty = true;
let intakeEntries = [];
let intakeStatus = "idle";
let systemsStatus = "loading";
let vaultStatus = "idle";
let selectionStatus = "idle";
let startupRun = 0;
let foundationManifestSources = [];
let foundationBiosSets = [];
let foundationManifestStatus = "idle";
let foundationEmulatorStatus = "idle";
let foundationBiosStatus = "idle";
let launchStatus = "idle";
let emulatorProfiles = [];
let emulatorProfilesStatus = "idle";
let appVersion = null;
let launchRenderedGames = [];
let launchRenderedGroups = [];
let launchCardFrame = null;
let launchScrollFrame = null;
let launchScrollLast = 0;
let launchMiddleScroll = null;
let launchMiddleScrollFrame = null;

const graph = {
  frame: null,
  scene: null,
  positions: new Map(),
  animation: null,
  targetKey: "",
  hitboxes: [],
  panX: 0,
  panY: 0,
  zoom: 1,
  rotation: 0,
  pointers: new Map(),
  gesture: null
};

let renderedDetailId = "";

let rows = [];
const gameRows = ["CRPG", "JRPG", "ARPG", "Roguelike", "Immersive Sim"];
const networkRows = ["Studios", "Companies", "People"];
const orderLabels = { "first-release": "First released", "most-titles": "Most titles", "most-units": "Most units sold" };
const modeViews = {
  systems: { subject: "systems", layout: "timeline" },
  games: { subject: "games", layout: "tree" },
  network: { subject: "network", layout: "network" }
};
const number = new Intl.NumberFormat();
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const tauriInvoke = (command, args) => window.__TAURI__?.core?.invoke?.(command, args);
const ipcDecoder = new TextDecoder();
const tauriJson = async (command, args) => {
  const response = await tauriInvoke(command, args);
  if (response instanceof ArrayBuffer) return JSON.parse(ipcDecoder.decode(response));
  if (ArrayBuffer.isView(response)) {
    return JSON.parse(ipcDecoder.decode(new Uint8Array(
      response.buffer,
      response.byteOffset,
      response.byteLength
    )));
  }
  return response;
};
const shellInvoke = (command) => tauriInvoke(command)?.catch(console.error);
const systemTheme = window.matchMedia?.("(prefers-color-scheme: dark)");
let themeColours = {};
let canvasFonts = {};

function loadAppSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(appSettingsKey) || "{}");
    return normaliseAppSettings(demoView === "history"
      ? {
          ...stored,
          appTheme: "dark",
          lightColourScheme: "archivist",
          darkColourScheme: "archivist",
          lightMinimumContrast: false,
          darkMinimumContrast: false
        }
      : stored);
  } catch {
    return normaliseAppSettings({});
  }
}

function saveAppSettings() {
  if (demoView === "history") return;
  localStorage.setItem(appSettingsKey, JSON.stringify(state.appSettings));
}

function normaliseAppSettings(raw) {
  const settings = { ...defaultAppSettings, ...raw };
  return {
    ...settings,
    appTheme: appThemes.has(settings.appTheme) ? settings.appTheme : defaultAppSettings.appTheme,
    lightColourScheme: normaliseColourScheme("light", settings.lightColourScheme),
    darkColourScheme: normaliseColourScheme("dark", settings.darkColourScheme),
    lightMinimumContrast: Boolean(settings.lightMinimumContrast),
    darkMinimumContrast: Boolean(settings.darkMinimumContrast),
    customColours: {
      light: normaliseCustomColours(settings.customColours?.light),
      dark: normaliseCustomColours(settings.customColours?.dark)
    }
  };
}

function colourSchemeOptions(theme) {
  return [
    ["archivist", theme === "light" ? "Archivist PLATO" : "Archivist PLATO dark"],
    ...Object.entries(base16Schemes)
      .filter(([, scheme]) => scheme.variant === theme)
      .sort(([, a], [, b]) => a.label.localeCompare(b.label))
      .map(([id, scheme]) => [id, scheme.label]),
    ["custom", "Custom"]
  ];
}

function colourSchemeIds(theme) {
  return new Set(colourSchemeOptions(theme).map(([id]) => id));
}

function normaliseColourScheme(theme, value) {
  const scheme = legacyColourSchemes[theme]?.[value] || value;
  return colourSchemeIds(theme).has(scheme) ? scheme : defaultAppSettings[`${theme}ColourScheme`];
}

function normaliseCustomColours(colours = {}) {
  return Object.fromEntries(appColourFields
    .map(({ key }) => [key, hexColour(colours[key], "")])
    .filter(([, value]) => value));
}

function hexColour(value, fallback = "#000000") {
  const text = String(value || "").trim();
  const full = /^#([0-9a-f]{6})$/i.exec(text);
  if (full) return `#${full[1].toLowerCase()}`;
  const short = /^#([0-9a-f]{3})$/i.exec(text);
  if (short) return `#${short[1].split("").map((digit) => digit + digit).join("").toLowerCase()}`;
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i.exec(text);
  if (rgb) return `#${rgb.slice(1, 4).map((part) => clamp(Math.round(Number(part)), 0, 255).toString(16).padStart(2, "0")).join("")}`;
  return fallback;
}

function rgbString(hex) {
  const value = hexColour(hex).slice(1);
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)).join(", ");
}

function rgbaString(hex, alpha) {
  return `rgba(${rgbString(hex)}, ${alpha})`;
}

function colourParts(hex) {
  const value = hexColour(hex).slice(1);
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
}

function mixColour(from, to, amount) {
  const start = colourParts(from);
  const end = colourParts(to);
  return `#${start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount).toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance(hex) {
  return colourParts(hex)
    .map((channel) => channel / 255)
    .map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
}

function contrastRatio(foreground, background) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + .05) / (darker + .05);
}

function bestContrast(backgrounds, candidates, minimum = minUiContrastRatio) {
  const bgList = [backgrounds].flat().filter(Boolean);
  const scored = candidates
    .filter(Boolean)
    .map((candidate) => hexColour(candidate, ""))
    .filter(Boolean)
    .map((candidate) => ({
      candidate,
      score: Math.min(...bgList.map((background) => contrastRatio(candidate, background)))
    }))
    .sort((a, b) => b.score - a.score);
  return scored.find(({ score }) => score >= minimum)?.candidate || scored[0]?.candidate || "#000000";
}

function contrastAdjustedBackground(background, foreground, minimum = minUiContrastRatio) {
  if (contrastRatio(foreground, background) >= minimum) return background;
  const target = relativeLuminance(foreground) < .5 ? "#ffffff" : "#000000";
  return Array.from({ length: 20 }, (_, index) => mixColour(background, target, (index + 1) / 20))
    .find((colour) => contrastRatio(foreground, colour) >= minimum) || target;
}

function defaultThemeColours(theme) {
  const selectors = theme === "light" ? [":root", 'html[data-theme="light"]'] : [":root"];
  const colours = {};
  [...document.styleSheets].forEach((sheet) => {
    [...(sheet.cssRules || [])]
      .filter((rule) => selectors.includes(rule.selectorText))
      .forEach((rule) => appColourFields.forEach(({ key, css }) => {
        const value = rule.style.getPropertyValue(css);
        if (value) colours[key] = hexColour(value, colours[key]);
      }));
  });
  return colours;
}

function minimumContrastColours(colours) {
  const seedNeutral = [colours.text, colours.strongText, colours.muted, colours.dim, colours.bg, colours.panel, colours.panel2, "#000000", "#ffffff"];
  const text = bestContrast(colours.bg, seedNeutral);
  const bg = contrastAdjustedBackground(colours.bg, text);
  const panel = contrastAdjustedBackground(colours.panel, text);
  const panel2 = contrastAdjustedBackground(colours.panel2, text);
  const accentSurface = contrastAdjustedBackground(colours.accentSurface, text);
  const canvasNode = contrastAdjustedBackground(colours.canvasNode, text);
  const canvasNodeCollapsed = contrastAdjustedBackground(colours.canvasNodeCollapsed, text);
  const neutral = [text, ...seedNeutral];
  const accentSeed = colours.accent;
  const onAccent = bestContrast(accentSeed, [colours.onAccent, text, colours.text, colours.strongText, "#000000", "#ffffff"]);
  const accent = contrastAdjustedBackground(accentSeed, onAccent);
  const accentTarget = relativeLuminance(onAccent) < .5 ? "#ffffff" : "#000000";
  const accentTop = contrastAdjustedBackground(mixColour(accent, accentTarget, .16), onAccent);
  const accentBottom = contrastAdjustedBackground(mixColour(accent, accentTarget, .04), onAccent);
  return {
    ...colours,
    bg,
    panel,
    panel2,
    accent,
    accentHi: accentTop,
    accentTop,
    accentBottom,
    text: bestContrast([bg, panel, panel2], neutral),
    muted: bestContrast([bg, panel], neutral),
    dim: bestContrast(panel, neutral),
    onAccent,
    strongText: bestContrast([bg, panel, panel2, accentSurface], neutral),
    titlebarBg: bg,
    accentSurface,
    dangerSurface: panel,
    controlBg: panel,
    canvasNodeBorder: accent,
    canvasNode,
    canvasNodeCollapsed,
    canvasText: bestContrast(canvasNode, neutral),
    canvasMuted: bestContrast(canvasNode, neutral),
    canvasGrid: panel2,
    canvasGridMinor: panel,
    canvasAxisText: bestContrast(bg, neutral),
    canvasRow: panel2,
    canvasLink: accent,
    canvasGlow: accent
  };
}

function base16AppColours(slots, minimumContrast = false) {
  const [
    bg, panel, panel2, line, base04, base05, , base07,
    red, accent, accentHi, green, , blue, pink
  ] = slots;
  const colours = {
    bg,
    panel,
    panel2,
    line,
    accent,
    accentHi,
    accentTop: accentHi,
    accentBottom: accent,
    text: base05,
    muted: base04,
    dim: line,
    green,
    red,
    blue,
    pink,
    onAccent: bg,
    strongText: base07,
    titlebarBg: bg,
    accentSurface: panel,
    dangerSurface: panel,
    controlBg: panel,
    rangeLine: line,
    canvasNode: panel,
    canvasNodeCollapsed: bg,
    canvasNodeBorder: accent,
    canvasNodeBorderCollapsed: line,
    canvasText: base05,
    canvasMuted: base04,
    canvasGrid: panel2,
    canvasGridMinor: panel,
    canvasAxis: line,
    canvasAxisText: base04,
    canvasRow: panel2,
    canvasDot: base07,
    canvasLink: accent,
    canvasGlow: accent
  };
  return minimumContrast ? minimumContrastColours(colours) : colours;
}

function paletteColours(theme, scheme, minimumContrast = false) {
  if (scheme === "archivist") return defaultThemeColours(theme);
  return base16AppColours(base16Schemes[scheme]?.palette || base16Fallback(theme), minimumContrast);
}

function base16Fallback(theme) {
  return Object.values(base16Schemes).find((scheme) => scheme.variant === theme)?.palette || base16Schemes.defaultDark?.palette || [];
}

function customColours(theme) {
  return { ...paletteColours(theme, "archivist"), ...state.appSettings.customColours[theme] };
}

function activeSchemeColours(theme) {
  const scheme = state.appSettings[`${theme}ColourScheme`];
  return scheme === "custom" ? customColours(theme) : paletteColours(theme, scheme, state.appSettings[`${theme}MinimumContrast`]);
}

function ensureCustomColours(theme) {
  state.appSettings.customColours[theme] = { ...activeSchemeColours(theme), ...state.appSettings.customColours[theme] };
}

function clearAppliedColours() {
  [...appColourFields.map(({ css }) => css), ...derivedColourVars].forEach((name) => document.documentElement.style.removeProperty(name));
}

function applyColourScheme(theme) {
  clearAppliedColours();
  const scheme = state.appSettings[`${theme}ColourScheme`];
  if (scheme === "archivist") return;

  const colours = activeSchemeColours(theme);
  appColourFields.forEach((field) => {
    const value = colours[field.key];
    document.documentElement.style.setProperty(field.css, field.alpha ? rgbaString(value, field.alpha[theme]) : value);
  });
  document.documentElement.style.setProperty("--accent-rgb", rgbString(colours.accent));
  document.documentElement.style.setProperty("--blue-rgb", rgbString(colours.blue));
  document.documentElement.style.setProperty("--surface-rgb", rgbString(colours.panel));
  document.documentElement.style.setProperty("--shadow-rgb", rgbString(theme === "light" ? colours.dim : colours.bg));
  document.documentElement.style.setProperty("--highlight-rgb", rgbString(theme === "light" ? colours.strongText : colours.text));
}

function readThemeColours() {
  const styles = getComputedStyle(document.documentElement);
  const css = (name) => styles.getPropertyValue(name).trim();
  themeColours = {
    accent: css("--accent"),
    green: css("--green"),
    red: css("--red"),
    bg: css("--bg"),
    canvasNode: css("--canvas-node"),
    canvasNodeCollapsed: css("--canvas-node-collapsed"),
    canvasNodeBorder: css("--canvas-node-border"),
    canvasNodeBorderCollapsed: css("--canvas-node-border-collapsed"),
    canvasText: css("--canvas-text"),
    canvasMuted: css("--canvas-muted"),
    canvasGrid: css("--canvas-grid"),
    canvasGridMinor: css("--canvas-grid-minor"),
    canvasAxis: css("--canvas-axis"),
    canvasAxisText: css("--canvas-axis-text"),
    canvasRow: css("--canvas-row"),
    canvasDot: css("--canvas-dot"),
    canvasLink: css("--canvas-link"),
    canvasGlow: css("--canvas-glow")
  };
  canvasFonts = {
    monogram: `700 ${css("--type-section")} Inter, sans-serif`,
    title: `500 ${css("--type-panel")} Inter, sans-serif`,
    row: `${css("--type-row")} Inter, sans-serif`
  };
}

function resolvedAppTheme() {
  return state.appSettings.appTheme === "system" ? (systemTheme?.matches ? "dark" : "light") : state.appSettings.appTheme;
}

function themedBrandMark(theme, accent) {
  const background = theme === "light" ? "#f6f1eb" : "#10100f";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect x="22" y="22" width="212" height="212" rx="32" fill="${background}" stroke="${accent}" stroke-width="10"/><path d="M70 194 128 58l58 136" fill="none" stroke="${accent}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function applyAppTheme() {
  const theme = resolvedAppTheme();
  document.documentElement.dataset.appTheme = state.appSettings.appTheme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  applyColourScheme(theme);
  readThemeColours();
  $("#brandMark").src = themedBrandMark(theme, themeColours.accent);
  tauriInvoke("set_app_icon_theme", { theme, accent: themeColours.accent })?.catch(console.error);
  if (graph.scene) requestGraphFrame();
}

function syncWindowSettings() {
  tauriInvoke("set_window_settings", { closeToTray: state.appSettings.closeToTray })?.catch(console.error);
  updateWindowControlLabels();
}

function syncLaunchOnStartup() {
  tauriInvoke("launch_on_startup_enabled")?.then((enabled) => {
    state.appSettings.launchOnStartup = enabled;
    renderSettings();
  }).catch(console.error);
}

function renderColourSchemeSelect(selector, theme, value) {
  const select = $(selector);
  select.replaceChildren(...colourSchemeOptions(theme).map(([id, label]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    return option;
  }));
  select.value = value;
}

function renderMinimumContrastSetting(theme) {
  const input = $(`#setting${theme[0].toUpperCase()}${theme.slice(1)}MinimumContrast`);
  const scheme = state.appSettings[`${theme}ColourScheme`];
  const available = Boolean(base16Schemes[scheme]);
  input.checked = state.appSettings[`${theme}MinimumContrast`];
  input.disabled = !available;
  input.closest(".settings-row").classList.toggle("unavailable", !available);
}

function renderCustomColourTray(theme) {
  const tray = $(`#${theme}CustomColourTray`);
  const open = state.appSettings[`${theme}ColourScheme`] === "custom";
  tray.hidden = !open;
  if (!open) {
    tray.replaceChildren();
    return;
  }

  const colours = customColours(theme);
  tray.replaceChildren(...appColourFields.map((field) => {
    const label = document.createElement("label");
    const text = document.createElement("span");
    const input = document.createElement("input");
    label.className = "colour-field";
    text.textContent = field.label;
    input.type = "color";
    input.value = colours[field.key];
    input.dataset.customTheme = theme;
    input.dataset.customColour = field.key;
    input.setAttribute("aria-label", `${theme} ${field.label}`);
    label.append(text, input);
    return label;
  }));
}

function renderSettings() {
  $("#settingAppTheme").value = state.appSettings.appTheme;
  renderColourSchemeSelect("#settingLightColourScheme", "light", state.appSettings.lightColourScheme);
  renderColourSchemeSelect("#settingDarkColourScheme", "dark", state.appSettings.darkColourScheme);
  renderMinimumContrastSetting("light");
  renderMinimumContrastSetting("dark");
  renderCustomColourTray("light");
  renderCustomColourTray("dark");
  $("#settingLaunchOnStartup").checked = state.appSettings.launchOnStartup;
  $("#settingMinimizeToTray").checked = state.appSettings.minimizeToTray;
  $("#settingCloseToTray").checked = state.appSettings.closeToTray;
  updateWindowControlLabels();
}

function updateWindowControlLabels() {
  const minimizeLabel = state.appSettings.minimizeToTray ? "Minimize to tray" : "Minimize";
  const closeLabel = state.appSettings.closeToTray ? "Close to tray" : "Close";
  $("#minimizeWindow").title = minimizeLabel;
  $("#minimizeWindow").setAttribute("aria-label", minimizeLabel);
  $("#closeWindow").title = closeLabel;
  $("#closeWindow").setAttribute("aria-label", closeLabel);
}

function openSettings() {
  $("#aboutModal").hidden = true;
  $("#openAbout").setAttribute("aria-expanded", "false");
  $("#emulatorsModal").hidden = true;
  $("#openEmulators").setAttribute("aria-expanded", "false");
  $("#settingsModal").hidden = false;
  $("#openSettings").setAttribute("aria-expanded", "true");
  renderSettings();
  $("#settingMinimizeToTray").focus();
}

function emulatorTableMessage(message, loading = false) {
  const row = document.createElement("tr");
  row.className = "emulator-table-message";
  const cell = document.createElement("td");
  cell.colSpan = 4;
  if (loading) cell.append(platoPulseElement(true), document.createTextNode(message));
  else cell.textContent = message;
  row.append(cell);
  return row;
}

const emulatorConfigurationGroups = [
  { id: "computers", label: "Computers", matches: (kind) => kind.startsWith("Computer") },
  { id: "consoles", label: "Consoles", matches: (kind) => kind.startsWith("Console") || kind === "Add-on" },
  { id: "handhelds", label: "Handhelds", matches: (kind) => kind.includes("Handheld") },
  { id: "arcade-cabinets", label: "Arcade cabinets", matches: (kind) => kind === "Cabinet" },
  { id: "fixed-function-devices", label: "Fixed-function devices", matches: (kind) => kind === "Dedicated hardware" },
  { id: "other-systems", label: "Other systems", matches: () => true }
];
const collapsedEmulatorGroups = new Set(["fixed-function-devices"]);

function emulatorConfigurationGroup(profile) {
  return emulatorConfigurationGroups.find((group) => group.matches(profile.kind || ""));
}

function emulatorGroupRow(group, count, collapsed, queryActive) {
  const row = document.createElement("tr");
  row.className = "emulator-group-row";
  const cell = document.createElement("td");
  cell.colSpan = 4;
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-expanded", String(!collapsed));
  button.disabled = queryActive;
  button.innerHTML = `<span class="emulator-group-arrow" aria-hidden="true"></span><strong>${group.label}</strong><small>${number.format(count)} mappings</small>`;
  if (!queryActive) button.addEventListener("click", () => {
    if (collapsedEmulatorGroups.has(group.id)) collapsedEmulatorGroups.delete(group.id);
    else collapsedEmulatorGroups.add(group.id);
    renderEmulatorProfiles();
  });
  cell.append(button);
  row.append(cell);
  return row;
}

function emulatorProfileRow(profile) {
  const row = document.createElement("tr");
  const system = document.createElement("td");
  system.textContent = profile.system;
  const emulator = document.createElement("td");
  emulator.textContent = profile.emulator;
  if (profile.preferred) {
    const preferred = document.createElement("span");
    preferred.className = "preferred";
    preferred.textContent = "Preferred";
    emulator.append(preferred);
  }
  const profileName = document.createElement("td");
  profileName.textContent = profile.profile || "-";
  const command = document.createElement("td");
  const code = document.createElement("code");
  code.textContent = profile.command || "No launch rule";
  if (!profile.command) code.className = "unavailable";
  command.append(code);
  row.append(system, emulator, profileName, command);
  return row;
}

function renderEmulatorProfiles() {
  const body = $("#emulatorProfiles");
  body.replaceChildren();
  if (emulatorProfilesStatus === "loading") {
    $("#emulatorCount").textContent = "Loading";
    body.append(emulatorTableMessage("Reading launch configuration", true));
    return;
  }
  if (emulatorProfilesStatus === "error") {
    $("#emulatorCount").textContent = "Unavailable";
    body.append(emulatorTableMessage("Launch configuration could not be read."));
    return;
  }

  const query = $("#emulatorSearch").value.trim().toLowerCase();
  const visible = emulatorProfiles.filter((profile) =>
    !query || [profile.system, profile.emulator, profile.profile, profile.command]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  );
  $("#emulatorCount").textContent = `${number.format(visible.length)} unique mappings`;
  emulatorConfigurationGroups.forEach((group) => {
    const profiles = visible.filter((profile) => emulatorConfigurationGroup(profile) === group);
    if (!profiles.length) return;
    const collapsed = !query && collapsedEmulatorGroups.has(group.id);
    body.append(emulatorGroupRow(group, profiles.length, collapsed, Boolean(query)));
    if (!collapsed) body.append(...profiles.map(emulatorProfileRow));
  });
  if (!visible.length) body.append(emulatorTableMessage("No mappings match this search."));
}

async function loadEmulatorProfiles() {
  emulatorProfilesStatus = "loading";
  renderEmulatorProfiles();
  try {
    emulatorProfiles = await tauriInvoke("emulator_profiles");
    emulatorProfilesStatus = "ready";
    rebuildLaunchGames();
  } catch (error) {
    console.error(error);
    emulatorProfilesStatus = "error";
  }
  renderEmulatorProfiles();
}

function openEmulators() {
  $("#aboutModal").hidden = true;
  $("#openAbout").setAttribute("aria-expanded", "false");
  $("#settingsModal").hidden = true;
  $("#openSettings").setAttribute("aria-expanded", "false");
  $("#emulatorsModal").hidden = false;
  $("#openEmulators").setAttribute("aria-expanded", "true");
  $("#emulatorSearch").value = "";
  renderEmulatorProfiles();
  $("#emulatorSearch").focus();
  if (emulatorProfilesStatus === "idle" || emulatorProfilesStatus === "error") {
    loadEmulatorProfiles();
  }
}

function closeEmulators() {
  $("#emulatorsModal").hidden = true;
  $("#openEmulators").setAttribute("aria-expanded", "false");
  $("#openEmulators").focus();
}

async function openAbout() {
  $("#settingsModal").hidden = true;
  $("#openSettings").setAttribute("aria-expanded", "false");
  $("#emulatorsModal").hidden = true;
  $("#openEmulators").setAttribute("aria-expanded", "false");
  $("#aboutModal").hidden = false;
  $("#openAbout").setAttribute("aria-expanded", "true");
  if (appVersion) {
    $("#aboutVersion").textContent = `Version ${appVersion}`;
    $("#closeAbout").focus();
    return;
  }
  try {
    appVersion = await tauriInvoke("app_version");
    $("#aboutVersion").textContent = `Version ${appVersion}`;
  } catch (error) {
    console.error(error);
    $("#aboutVersion").textContent = "Version unavailable";
  }
  $("#closeAbout").focus();
}

function closeAbout() {
  $("#aboutModal").hidden = true;
  $("#openAbout").setAttribute("aria-expanded", "false");
  $("#openAbout").focus();
}

function closeSettings() {
  $("#settingsModal").hidden = true;
  $("#openSettings").setAttribute("aria-expanded", "false");
  $("#openSettings").focus();
}

function setAppSetting(key, value) {
  state.appSettings[key] = value;
  saveAppSettings();
  if (key === "appTheme") {
    applyAppTheme();
  } else {
    syncWindowSettings();
  }
}

function setAppColourScheme(theme, scheme) {
  if (!colourSchemeIds(theme).has(scheme)) return;
  if (scheme === "custom") ensureCustomColours(theme);
  state.appSettings[`${theme}ColourScheme`] = scheme;
  saveAppSettings();
  applyAppTheme();
  renderSettings();
}

function setMinimumContrast(theme, enabled) {
  state.appSettings[`${theme}MinimumContrast`] = enabled;
  saveAppSettings();
  applyAppTheme();
  renderSettings();
}

function setCustomColour(theme, key, value) {
  const colour = hexColour(value, "");
  if (!colour || !appColourFields.some((field) => field.key === key)) return;
  state.appSettings.customColours[theme] = { ...state.appSettings.customColours[theme], [key]: colour };
  saveAppSettings();
  if (resolvedAppTheme() === theme) applyAppTheme();
}

function setLaunchOnStartup(enabled) {
  state.appSettings.launchOnStartup = enabled;
  renderSettings();
  tauriInvoke("set_launch_on_startup", { enabled })?.then(syncLaunchOnStartup).catch((error) => {
    console.error(error);
    state.appSettings.launchOnStartup = !enabled;
    renderSettings();
  });
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function rowForSystem(system) {
  const text = `${system.kind || ""} ${system.era || ""}`;
  if (/cabinet|arcade|board|mini-arcade/i.test(text)) return "Cabinets";
  if (/handheld|mobile|pda|portable/i.test(text)) return "Handhelds";
  if (/computer|terminal|workstation|desktop operating|interpreter|web|software environment|fantasy/i.test(text)) return "Computers";
  return "Consoles";
}

function spanFor(nodes, ids) {
  const years = ids.map((id) => nodes[id]?.year).filter((year) => Number.isFinite(year));
  if (!years.length) return "";
  return `${Math.min(...years)}-${Math.max(...years)}`;
}

function systemNodeId(system) {
  return system.slug || system.id;
}

function nodeKey(node) {
  return state.subject === "systems" ? systemNodeId(node) : node.id;
}

function titleCount(node) {
  return node.gameCount ?? node.count ?? 0;
}

function makerName(node) {
  return node.manufacturer || node.maker || "Unknown";
}

function defaultEmulator(node) {
  return node.emulators?.[0] || node.emulator || "Unconfigured";
}

function computerSectionForSystem(system, row) {
  if (row !== "Computers") return null;
  if (system.era === "Computer mainframe") return { type: "Mainframe" };
  if (system.era === "Computer minicomputer") return { type: "Minicomputer" };
  if (system.era === "Early microcomputer" || system.era === "Single-board computer") return { type: "Microcomputer" };
  if ([
    "1977 Trinity",
    "8-bit computer era",
    "8-bit computer add-on era",
    "16-bit computer era",
    "PC clone era",
    "32-bit computer era",
    "Modern retro computer"
  ].includes(system.era)) return { type: "Home computer", era: system.era };
  return null;
}

function hydrateOwnership(nodes, files) {
  const ownedSystems = new Set(files.flatMap((file) => [file.systemSlug, file.systemId]).filter(Boolean));
  Object.values(nodes).forEach((node) => {
    if (node.type === "system") node.owned = ownedSystems.has(systemNodeId(node)) || ownedSystems.has(node.id);
  });
  const propagate = (node) => {
    if (node.children?.length) node.owned = node.children.map((id) => propagate(nodes[id])).some(Boolean);
    return node.owned;
  };
  Object.values(nodes).filter((node) => !node.parent).forEach(propagate);
}

function buildSystemTree(systems, files) {
  const nodes = {};
  const roots = [];
  const ensureGroup = (id, parent, node) => {
    if (!nodes[id]) {
      if (parent) nodes[parent].children.push(id);
      else roots.push(id);
      nodes[id] = node;
    }
    return id;
  };

  systems.forEach((source) => {
    const row = rowForSystem(source);
    const rootId = slug(row);
    ensureGroup(rootId, null, { id: rootId, name: row, type: "category", row, year: source.year ?? 1972, span: "", count: 0, owned: false, children: [] });

    const section = computerSectionForSystem(source, row);
    const sectionId = section
      ? ensureGroup(`${rootId}-${slug(section.type)}`, rootId, { id: `${rootId}-${slug(section.type)}`, parent: rootId, name: section.type, type: "type", row, year: source.year ?? nodes[rootId].year, span: "", count: 0, owned: false, children: [] })
      : rootId;
    const era = section?.era ?? (section ? null : source.era || "Uncategorised");
    const parentId = era
      ? ensureGroup(`${sectionId}-${slug(era)}`, sectionId, { id: `${sectionId}-${slug(era)}`, parent: sectionId, name: era, type: "era", row, year: source.year ?? nodes[sectionId].year, span: "", count: 0, owned: false, children: [] })
      : sectionId;

    const key = systemNodeId(source);
    nodes[parentId].children.push(key);
    nodes[key] = {
      ...source,
      parent: parentId,
      row,
      year: source.year ?? 1972,
      owned: false,
      emulators: source.emulators || [],
      enabledEmulators: source.enabledEmulators || [],
      type: "system",
      children: []
    };
  });

  const aggregate = (id) => {
    const node = nodes[id];
    if (!node.children?.length) return;
    node.children.forEach(aggregate);
    node.count = node.children.reduce((sum, id) => sum + titleCount(nodes[id]), 0);
    const years = node.children.map((id) => nodes[id]?.year).filter(Number.isFinite);
    if (years.length) node.year = Math.min(...years);
    const endYears = node.children
      .map((id) => nodes[id]?.endYear ?? nodes[id]?.year)
      .filter(Number.isFinite);
    node.endYear = endYears.length ? Math.max(...endYears) : node.year;
    node.span = spanFor(nodes, node.children);
  };
  roots.forEach(aggregate);
  hydrateOwnership(nodes, files);

  return { root: roots, nodes };
}

function launchTitleKey(system, title) {
  return `${system}\u0000${normalizedWords(title)}`;
}

function vaultCandidateTitles(file) {
  const candidates = [];
  let title = String(file.candidateTitle || file.fileName || "");
  while (title) {
    candidates.push(title);
    const stripped = title.replace(/\s+\([^)]*\)$/, "");
    if (stripped === title) break;
    title = stripped;
  }
  return candidates;
}

function buildLaunchGames(titles, files) {
  const selectedTitleKeys = new Set(titles.map((title) => launchTitleKey(title.system, title.title)));
  const filesByTitle = files.reduce((matches, file) => {
    const key = vaultCandidateTitles(file)
      .map((candidate) => launchTitleKey(file.system, candidate))
      .find((candidate) => selectedTitleKeys.has(candidate));
    if (!key) return matches;
    const group = matches.get(key);
    if (group) group.push(file);
    else matches.set(key, [file]);
    return matches;
  }, new Map());
  const profilesBySystemEmulator = new Map(emulatorProfiles.map((profile) => [
    `${profile.system}\u0000${profile.emulator}`,
    profile
  ]));
  const ports = titles.flatMap((title) => {
    const system = systems.find((candidate) => candidate.name === title.system);
    if (!system) return [];
    const vaultMatches = filesByTitle.get(launchTitleKey(title.system, title.title)) || [];
    const vaultFile = vaultMatches[0] || null;
    const profile = profilesBySystemEmulator.get(`${title.system}\u0000${title.emulator}`);
    return [{
      ...title,
      system: title.system,
      systemId: system.id,
      systemSlug: system.slug,
      systemYear: system.year,
      fileName: vaultFile?.fileName || null,
      path: vaultFile?.path || null,
      romPresent: Boolean(vaultFile),
      emulatorAvailable: Boolean(profile?.installed && profile?.command)
    }];
  });
  return ports.map((port) => ({
    id: `${port.systemSlug}-${slug(port.title)}`,
    title: port.title,
    ports: [port]
  }));
}

function rebuildLaunchGames() {
  if (selectionStatus !== "ready" || systemsStatus !== "ready") return;
  launchGames = buildLaunchGames(desiredTitles, vaultFiles);
  state.launchGame = launchGames.some((game) => game.id === state.launchGame)
    ? state.launchGame
    : launchGames[0]?.id || null;
  const launchGame = launchGames.find((game) => game.id === state.launchGame);
  state.launchPort = launchGame?.ports.some((port) => portKey(port) === state.launchPort)
    ? state.launchPort
    : launchGame?.ports[0] ? portKey(launchGame.ports[0]) : null;
}

function groupBy(items, keyFor) {
  return items.reduce((groups, item) => {
    const key = keyFor(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
    return groups;
  }, new Map());
}

function invalidateVerifyData() {
  verifyIndexDirty = true;
  verifyTreeDirty = true;
  verifyContentDirty = true;
  verifySelectionCounts.clear();
  verifyReleaseLists.clear();
  state.organizerStage = "unscanned";
}

function applySystems(loadedSystems) {
  systems = loadedSystems;
  systemsStatus = systems.length ? "ready" : "empty";
  systemTree = buildSystemTree(systems, vaultFiles);
  rows = systemTree.root.map((id) => systemTree.nodes[id].row);
  if (Array.isArray(window.__ARCHIVIST_INITIAL_OPEN_NODES)) {
    state.open = new Set(window.__ARCHIVIST_INITIAL_OPEN_NODES.filter((id) => systemTree.nodes[id]?.children?.length));
  }
  resetTimelineWindow();
  const initialWindow = window.__ARCHIVIST_INITIAL_TIMELINE_WINDOW;
  if (Number.isFinite(initialWindow?.min)
    && Number.isFinite(initialWindow?.max)
    && initialWindow.min < initialWindow.max) {
    state.yearMin = initialWindow.min;
    state.yearMax = initialWindow.max;
    clampTimelineWindow();
  }
  const initialSelected = window.__ARCHIVIST_INITIAL_SELECTED_NODE;
  if (initialSelected && systemTree.nodes[initialSelected]?.type === "system") state.selected = initialSelected;
  rebuildLaunchGames();
  invalidateVerifyData();
}

function applyVault(loadedVaultFiles) {
  vaultFiles = loadedVaultFiles;
  vaultStatus = "ready";
  systemVault = groupBy(vaultFiles, (file) => file.system);
  systemVaultTitles = new Map([...systemVault].map(([system, files]) => [
    system,
    new Set(files.map((file) => normalizedWords(file.candidateTitle || file.fileName)))
  ]));
  systemTree = buildSystemTree(systems, vaultFiles);
  rows = systemTree.root.map((id) => systemTree.nodes[id].row);
  rebuildLaunchGames();
  invalidateVerifyData();
}

function applySelection(selection) {
  desiredTitles = selection?.titles || [];
  manifestSelections = (selection?.manifests || [])
    .filter((manifest) => digestManifestPath(manifest.relativePath));
  selectionStatus = "ready";
  manifestSources = [...new Map(manifestSelections.map((manifest) => [
    manifest.relativePath,
    { relativePath: manifest.relativePath, selected: true, present: manifest.present }
  ])).values()];
  manifestSourcesStatus = "idle";
  manifestReleaseCache.clear();
  manifestReleasePromises.clear();
  systemTitles = groupBy(desiredTitles, (title) => title.system);
  systemTitleNames = new Map([...systemTitles].map(([system, titles]) => [
    system,
    new Set(titles.map((title) => normalizedWords(title.title)))
  ]));
  systemManifests = groupBy(manifestSelections, (manifest) => manifest.systemId);
  rebuildLaunchGames();
  invalidateVerifyData();
}

function resetStartupProgress() {
  $$("[data-startup-milestone]").forEach((milestone) => {
    milestone.classList.remove("active", "complete", "error");
  });
  $$("[data-startup-segment]").forEach((segment) => segment.classList.remove("complete"));
  $("#startupError").hidden = true;
  $("#startupRetry").hidden = true;
}

function setStartupStage(stage, status) {
  const milestone = $(`[data-startup-milestone="${stage}"]`);
  milestone?.classList.remove("active", "complete", "error");
  milestone?.classList.add(status);
  if (status === "complete") {
    $(`[data-startup-segment="${stage}"]`)?.classList.add("complete");
    if (stage === "vault") $(`[data-startup-segment="ready"]`)?.classList.add("complete");
  }
}

async function loadStartupStage(stage, command) {
  setStartupStage(stage, "active");
  try {
    const result = await tauriInvoke(command);
    setStartupStage(stage, "complete");
    return result;
  } catch (error) {
    setStartupStage(stage, "error");
    throw { stage, error };
  }
}

function showStartupError(stage, error) {
  systemsStatus = "error";
  const stageName = $(`[data-startup-milestone="${stage}"] span`)?.textContent || "Application data";
  $("#startupError").textContent = `${stageName}: ${String(error)}`;
  $("#startupError").hidden = false;
  $("#startupRetry").hidden = false;
}

function loadingActivity() {
  if (launchStatus === "loading") return "Launching game";
  if (manifestReleaseStatus === "loading") return "Reading release decisions";
  if (manifestSourcesStatus === "loading") return "Reading manifests";
  if (intakeStatus === "loading") return "Reading Intake";
  if (selectionStatus === "loading") return "Selecting titles";
  if (vaultStatus === "loading") return "Reading Vault";
  if (systemsStatus === "loading") return "Reading systems";
  return null;
}

function renderLoadingActivity() {
  const message = loadingActivity();
  const activity = $("#backgroundActivity");
  activity.hidden = !message;
  if (message) $("#backgroundActivityText").textContent = message;
}

function renderHydration() {
  renderAll();
  if (state.view === "verify" && selectionStatus === "ready") loadVerifyData();
}

function foundationVersion(path) {
  const match = path.match(/(?:TOSEC-v)?(20\d{2})-?(\d{2})-?(\d{2})/i);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function foundationManifestRows() {
  return [
    ["nointro", "No-Intro"],
    ["redump", "Redump"],
    ["tosec", "TOSEC"]
  ].map(([directory, name]) => {
    const required = foundationManifestSources.filter((source) =>
      source.selected && source.relativePath.startsWith(`${directory}/`));
    const present = required.filter((source) => source.present).length;
    const version = required.map((source) => foundationVersion(source.relativePath)).filter(Boolean).sort().at(-1);
    return {
      name,
      detail: `${number.format(present)} of ${number.format(required.length)} required${version ? ` · supported through ${version}` : ""}`,
      present: required.length > 0 && present === required.length,
      missing: required.length - present
    };
  });
}

function foundationEmulatorRows() {
  return [...new Map(emulatorProfiles
    .filter((profile) => profile.preferred && profile.requirement)
    .map((profile) => [profile.requirement, {
      name: profile.emulator,
      detail: `${profile.requirement.endsWith(".so") ? "Core" : "Executable"} · ${profile.requirement}`,
      present: profile.installed,
      missing: Number(!profile.installed)
    }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
}

function foundationBiosRows() {
  return foundationBiosSets.map((bios) => ({
    name: bios.name,
    detail: `${number.format(bios.files)} ${bios.files === 1 ? "file" : "files"}${bios.version ? ` · version ${bios.version}` : ""}`,
    present: bios.present,
    missing: Number(!bios.present)
  }));
}

function foundationRow(item) {
  const row = document.createElement("div");
  row.className = "foundation-row";
  row.append(lamp(item.present ? "green" : "red"));
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  const detail = document.createElement("small");
  name.textContent = item.name;
  detail.textContent = item.detail;
  copy.append(name, detail);
  row.append(copy);
  return row;
}

function renderFoundationSection(listSelector, countSelector, status, rows) {
  const list = $(listSelector);
  list.replaceChildren();
  if (status === "loading") {
    list.append(verifyEmpty("Checking local artifacts...", true));
    $(countSelector).textContent = "Checking";
    return;
  }
  if (status === "error") {
    list.append(foundationRow({ name: "Inventory unavailable", detail: "Recheck this section", present: false }));
    $(countSelector).textContent = "Unavailable";
    return;
  }
  list.replaceChildren(...rows.map(foundationRow));
  const present = rows.filter((row) => row.present).length;
  $(countSelector).textContent = `${number.format(present)} of ${number.format(rows.length)}`;
}

function renderFoundations() {
  const manifestRows = foundationManifestRows();
  const emulatorRows = foundationEmulatorRows();
  const biosRows = foundationBiosRows();
  renderFoundationSection("#foundationManifests", "#foundationManifestCount", foundationManifestStatus, manifestRows);
  renderFoundationSection("#foundationEmulators", "#foundationEmulatorCount", foundationEmulatorStatus, emulatorRows);
  renderFoundationSection("#foundationBioses", "#foundationBiosCount", foundationBiosStatus, biosRows);

  const checking = [foundationManifestStatus, foundationEmulatorStatus, foundationBiosStatus]
    .some((status) => status === "loading" || status === "idle");
  const errors = [foundationManifestStatus, foundationEmulatorStatus, foundationBiosStatus]
    .filter((status) => status === "error").length;
  const missing = [...manifestRows, ...emulatorRows, ...biosRows]
    .reduce((count, row) => count + row.missing, errors);
  const proceed = $("#foundationContinue");
  $("#foundationRecheck").disabled = checking;
  $("#verifyVaultStep").disabled = checking;
  proceed.disabled = checking;
  proceed.className = `${missing ? "dark-btn warning" : "accent-btn"} compact foundation-continue`;
  proceed.textContent = checking
    ? "Checking"
    : missing ? "Some functionality may not be available without all items present." : "Enter Archivist";
  $("#foundationSummary").textContent = checking
    ? "Checking local artifacts"
    : missing ? `${number.format(missing)} required artifacts unavailable` : "All foundational artifacts found";
}

async function loadFoundations() {
  foundationManifestStatus = "loading";
  foundationEmulatorStatus = "loading";
  foundationBiosStatus = "loading";
  renderFoundations();
  const [manifests, emulators, bioses] = await Promise.allSettled([
    tauriInvoke("manifest_sources"),
    tauriInvoke("emulator_profiles"),
    tauriInvoke("bios_sets")
  ]);

  if (manifests.status === "fulfilled") {
    foundationManifestSources = manifests.value;
    foundationManifestStatus = "ready";
  } else {
    console.error(manifests.reason);
    foundationManifestStatus = "error";
  }
  if (emulators.status === "fulfilled") {
    emulatorProfiles = emulators.value;
    emulatorProfilesStatus = "ready";
    foundationEmulatorStatus = "ready";
    rebuildLaunchGames();
  } else {
    console.error(emulators.reason);
    foundationEmulatorStatus = "error";
  }
  if (bioses.status === "fulfilled") {
    foundationBiosSets = bioses.value;
    foundationBiosStatus = "ready";
  } else {
    console.error(bioses.reason);
    foundationBiosStatus = "error";
  }
  renderFoundations();
}

async function loadBackgroundData(run) {
  vaultStatus = "loading";
  selectionStatus = "loading";
  renderHydration();

  try {
    const loadedVaultFiles = await tauriInvoke("vault_files");
    if (run !== startupRun) return;
    applyVault(loadedVaultFiles);
  } catch (error) {
    if (run !== startupRun) return;
    console.error(error);
    vaultStatus = "error";
  }
  renderHydration();

  try {
    emulatorProfilesStatus = "loading";
    emulatorProfiles = await tauriInvoke("emulator_profiles");
    if (run !== startupRun) return;
    emulatorProfilesStatus = "ready";
    rebuildLaunchGames();
  } catch (error) {
    if (run !== startupRun) return;
    console.error(error);
    emulatorProfilesStatus = "error";
  }
  renderHydration();

  try {
    const selection = await tauriJson("selection");
    if (run !== startupRun) return;
    applySelection(selection);
  } catch (error) {
    if (run !== startupRun) return;
    console.error(error);
    selectionStatus = "error";
  }
  renderHydration();
}

function revealApplication() {
  $("#appShell").inert = false;
  $("#startupSplash").classList.add("complete");
  window.setTimeout(() => $("#startupSplash").hidden = true, 240);
}

function showVerifyStage(stage) {
  if (stage === "vault" && $("#verifyVaultStep").disabled) return;
  state.verifyStage = stage;
  $("#foundationGate").hidden = stage !== "artifacts";
  $("#verifyDashboard").hidden = stage !== "vault";
  [["#verifyArtifactsStep", "artifacts"], ["#verifyVaultStep", "vault"]].forEach(([selector, value]) => {
    const selected = stage === value;
    $(selector).classList.toggle("active", selected);
    $(selector).setAttribute("aria-selected", String(selected));
  });
  if (stage === "vault") {
    loadVerifyData();
    if (intakeStatus === "idle") loadIntake();
    renderVerify();
  } else {
    renderFoundations();
  }
}

async function loadStartupData() {
  const run = ++startupRun;
  systemsStatus = "loading";
  vaultStatus = "idle";
  selectionStatus = "idle";
  $("#appShell").inert = true;
  $("#startupSplash").hidden = false;
  $("#startupSplash").classList.remove("complete");
  resetStartupProgress();

  if (!window.__TAURI__?.core?.invoke) {
    showStartupError("systems", "Open Archivist through the desktop shell to read local data.");
    return;
  }

  try {
    const loadedSystems = await loadStartupStage("systems", "systems");
    if (run !== startupRun) return;
    applySystems(loadedSystems);
    renderAll();
    revealApplication();
    if (systemsStatus === "ready") {
      requestAnimationFrame(() => window.setTimeout(() => loadBackgroundData(run), 0));
    }
  } catch ({ stage, error }) {
    console.error(error);
    showStartupError(stage, error);
  }
}

function normalizedWords(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function digestManifestPath(relativePath) {
  const path = String(relativePath || "");
  return !path.toLowerCase().startsWith("retroachievements/")
    && !normalizedWords(path).split(" ").includes("bios");
}

const allManifestsId = "all-manifests";

function verifyNode() {
  if (state.verifyNode === allManifestsId) {
    return { id: allManifestsId, name: "All manifests", type: "root", children: systemTree.root };
  }
  return systemTree.nodes[state.verifyNode] || null;
}

function systemForTreeNode(node) {
  if (node?.type !== "system") return null;
  const key = systemNodeId(node);
  return systems.find((system) => systemNodeId(system) === key) || null;
}

function systemsBelow(node) {
  if (!node) return [];
  const system = systemForTreeNode(node);
  if (system) return [system];
  return (node.children || [])
    .flatMap((id) => systemsBelow(systemTree.nodes[id]))
    .filter(Boolean);
}

function verifySystems() {
  return systemsBelow(verifyNode());
}

function selectedVerifySystem() {
  return systemForTreeNode(verifyNode());
}

function selectedTitlesForSystem(system) {
  return system ? systemTitles.get(system.name) || [] : [];
}

function selectedTitlesForSystems(selectedSystems) {
  return selectedSystems.flatMap(selectedTitlesForSystem);
}

function selectedManifestsForSystem(system) {
  return system ? systemManifests.get(system.id) || [] : [];
}

function selectedManifestsForSystems(selectedSystems) {
  return selectedSystems.flatMap(selectedManifestsForSystem);
}

function vaultFilesForSystems(selectedSystems) {
  return selectedSystems.flatMap((system) => systemVault.get(system.name) || []);
}

function titleExistsInVault(system, title) {
  if (vaultStatus !== "ready") return false;
  return systemVaultTitles.get(system.name)?.has(normalizedWords(title.title)) || false;
}

function manifestKey(system, relativePath) {
  return `${system.id}\u0000${relativePath}`;
}

function fileMatchesSelection(selectedSystems, file) {
  if (!selectedSystems.length || selectionStatus !== "ready") return false;
  const candidate = normalizedWords(
    file.candidateTitle || file.name?.replace(/\.[^.]+$/, "") || file.fileName
  );
  const matchingSystems = file.system
    ? selectedSystems.filter((system) => system.name === file.system)
    : selectedSystems;
  const candidates = matchingSystems.length ? matchingSystems : selectedSystems;
  return Boolean(candidate && candidates.some((system) =>
    systemTitleNames.get(system.name)?.has(candidate)));
}

function manifestMetrics(system, source, selection) {
  const wantedTitles = selectedTitlesForSystem(system)
    .filter((title) => title.manifestSources?.includes(source.relativePath));
  const vaultKnown = vaultStatus === "ready";
  const vault = vaultKnown
    ? wantedTitles.filter((title) => titleExistsInVault(system, title)).length
    : 0;
  const wanted = selection?.wanted ?? wantedTitles.length;
  const described = selection?.described ?? 0;
  const intake = 0;
  return {
    described,
    wanted,
    vault,
    intake,
    missing: vaultKnown ? Math.max(0, wanted - vault - intake) : 0,
    pending: vaultKnown ? 0 : wanted,
    vaultKnown,
    discarded: Math.max(0, described - wanted)
  };
}

function manifestsForSystem(system) {
  rebuildVerifyIndex();
  return verifyManifests.get(system.id)?.[state.verifyManifestFilter] || [];
}

function rebuildVerifyIndex() {
  if (!verifyIndexDirty) return;
  const sources = manifestSources.map((source) => ({
    source,
    searchName: normalizedWords(source.relativePath)
  }));
  verifyManifests = new Map();
  verifySources = new Map(manifestSources.map((source) => [source.relativePath, source]));
  verifySystemCounts = new Map();

  systems.forEach((system) => {
    const selections = new Map(selectedManifestsForSystem(system)
      .map((selection) => [selection.relativePath, selection]));
    const candidates = [system.id, system.name].map(normalizedWords).filter(Boolean);
    const related = sources
      .filter(({ source, searchName }) => selections.has(source.relativePath)
        || candidates.some((candidate) => searchName.includes(candidate)))
      .map(({ source }) => ({
        source,
        selection: selections.get(source.relativePath) || null
      }))
      .sort((a, b) => Number(b.source.selected) - Number(a.source.selected)
        || Number(b.source.present) - Number(a.source.present)
        || a.source.relativePath.localeCompare(b.source.relativePath));
    const titles = selectedTitlesForSystem(system);
    verifyManifests.set(system.id, {
      all: related,
      selected: related.filter(({ source }) => source.selected),
      discarded: related.filter(({ source }) => !source.selected)
    });
    verifySystemCounts.set(system.id, {
      wanted: titles.length,
      vault: vaultStatus === "ready"
        ? titles.filter((title) => titleExistsInVault(system, title)).length
        : 0
    });
  });

  verifyIndexDirty = false;
  verifySelectionCounts.clear();
}

function selectionCounts(selectedSystems) {
  rebuildVerifyIndex();
  const cacheKey = `${state.verifyManifestFilter}\u0000${selectedSystems
    .map((system) => system.id)
    .join("\u0000")}`;
  if (verifySelectionCounts.has(cacheKey)) return verifySelectionCounts.get(cacheKey);
  const selectedManifests = selectedManifestsForSystems(selectedSystems);
  const visibleManifests = selectedSystems.flatMap((system) =>
    manifestsForSystem(system).map(({ source }) => source.relativePath));
  const vaultKnown = vaultStatus === "ready";
  const wanted = selectedSystems.reduce((total, system) =>
    total + (verifySystemCounts.get(system.id)?.wanted || 0), 0);
  const vault = selectedSystems.reduce((total, system) =>
    total + (verifySystemCounts.get(system.id)?.vault || 0), 0);
  const counts = {
    manifests: new Set(visibleManifests).size,
    selectedManifests: new Set(selectedManifests.map((manifest) => manifest.relativePath)).size,
    wanted,
    vault,
    missing: vaultKnown ? Math.max(0, wanted - vault) : 0,
    vaultKnown
  };
  verifySelectionCounts.set(cacheKey, counts);
  return counts;
}

function lamp(colour) {
  const element = document.createElement("span");
  element.className = `lamp ${colour}`;
  element.setAttribute("aria-hidden", "true");
  return element;
}

function selectionColour(counts) {
  if (!counts.selectedManifests || state.verifyManifestFilter === "discarded" || !counts.vaultKnown) {
    return "dim";
  }
  if (counts.missing) return "red";
  if (counts.wanted && counts.vault === counts.wanted) return "green";
  return "dim";
}

function statusColour(metrics, source) {
  if (!source.present) return "red";
  if (!source.selected || !metrics.vaultKnown) return "dim";
  if (metrics.missing) return "red";
  if (metrics.intake) return "blue";
  if (metrics.wanted && metrics.vault === metrics.wanted) return "green";
  return "dim";
}

function manifestProgress(metrics) {
  const progress = document.createElement("span");
  progress.className = "manifest-progress";
  const total = Math.max(1, metrics.described, metrics.wanted);
  [
    ["vault", metrics.vault],
    ["intake", metrics.intake],
    ["missing", metrics.missing],
    ["pending", metrics.pending],
    ["discarded", metrics.discarded]
  ].forEach(([name, count]) => {
    const segment = document.createElement("span");
    segment.className = name;
    segment.style.width = `${count / total * 100}%`;
    progress.append(segment);
  });
  return progress;
}

function manifestRow(system, source, selection, depth) {
  const metrics = manifestMetrics(system, source, selection);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `manifest-row${source.selected ? "" : " unused"}${source.present ? "" : " missing"}`;
  button.dataset.verifyNode = systemNodeId(system);
  button.dataset.verifyManifest = source.relativePath;
  button.classList.toggle("active", state.verifyManifest === source.relativePath
    && state.verifyNode === systemNodeId(system));
  button.style.setProperty("--tree-depth", depth);
  button.title = source.relativePath;
  button.append(lamp(statusColour(metrics, source)));

  const name = document.createElement("span");
  name.className = "manifest-name";
  name.textContent = source.relativePath;
  button.append(name);

  const counts = document.createElement("span");
  counts.className = "manifest-counts";
  const vaultCount = metrics.vaultKnown
    ? `${metrics.vault} vault`
    : vaultStatus === "error" ? "Vault unavailable" : "Vault loading";
  counts.textContent = source.present
    ? `${metrics.described || "?"} described · ${metrics.wanted} selected · ${vaultCount}`
    : "Expected by Archivist · missing from manifest directory";
  button.append(counts, manifestProgress(metrics));
  button.addEventListener("click", () => selectManifest(system, source));
  return button;
}

function unmatchedVaultFiles(system) {
  if (vaultStatus !== "ready" || selectionStatus !== "ready") return [];
  return (systemVault.get(system.name) || [])
    .filter((file) => !fileMatchesSelection([system], file));
}

function visibleVerifySystemIds() {
  const query = normalizedWords(state.verifyQuery);
  return new Set(systems.filter((system) => {
    const manifests = manifestsForSystem(system);
    if (!manifests.length) return false;
    if (!query) return true;
    const manifestNames = manifests
      .map(({ source }) => source.relativePath)
      .join(" ");
    return normalizedWords(`${system.name} ${system.id} ${manifestNames}`).includes(query);
  }).map(systemNodeId));
}

function treeNodeVisible(node, visibleSystemIds) {
  const system = systemForTreeNode(node);
  return system
    ? visibleSystemIds.has(systemNodeId(system))
    : (node.children || []).some((id) => treeNodeVisible(systemTree.nodes[id], visibleSystemIds));
}

function treeNodeCountText(counts) {
  if (!counts.vaultKnown) {
    const vault = vaultStatus === "error" ? "Vault unavailable" : "Vault loading";
    return `${counts.manifests} manifests · ${vault}`;
  }
  return `${counts.manifests} manifests · ${counts.vault}/${counts.wanted} vault`;
}

function toggleVerifyNode(nodeId) {
  if (state.verifyOpenNodes.has(nodeId)) state.verifyOpenNodes.delete(nodeId);
  else state.verifyOpenNodes.add(nodeId);
  verifyTreeDirty = true;
  renderVerifySystems();
}

function renderVerifyTreeNode(node, depth, visibleSystemIds) {
  const system = systemForTreeNode(node);
  const branchChildren = system
    ? []
    : (node.children || [])
      .map((id) => systemTree.nodes[id])
      .filter((child) => child && treeNodeVisible(child, visibleSystemIds));
  const systemManifests = system ? manifestsForSystem(system) : [];
  const extras = system ? unmatchedVaultFiles(system) : [];
  const hasChildren = Boolean(branchChildren.length || systemManifests.length || extras.length);
  const open = state.verifyOpenNodes.has(node.id);
  const counts = selectionCounts(systemsBelow(node));
  const container = document.createElement("div");
  container.className = "verify-tree-node";

  const line = document.createElement("div");
  line.className = `verify-tree-line${counts.manifests ? "" : " unused"}`;
  line.dataset.verifyNode = node.id;
  line.classList.toggle("active", state.verifyNode === node.id && !state.verifyManifest);
  line.style.setProperty("--tree-depth", depth);

  if (hasChildren) {
    const disclosure = document.createElement("button");
    disclosure.type = "button";
    disclosure.className = "verify-disclosure";
    disclosure.textContent = open ? "▾" : "▸";
    disclosure.setAttribute("aria-label", `${open ? "Collapse" : "Expand"} ${node.name}`);
    disclosure.setAttribute("aria-expanded", String(open));
    disclosure.addEventListener("click", () => toggleVerifyNode(node.id));
    line.append(disclosure);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "verify-disclosure spacer";
    line.append(spacer);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "verify-node-button";
  button.append(lamp(selectionColour(counts)));
  const name = document.createElement("span");
  name.className = "verify-system-name";
  name.textContent = node.name;
  const count = document.createElement("span");
  count.className = "verify-system-count";
  count.textContent = treeNodeCountText(counts);
  button.append(name, count);
  button.addEventListener("click", () => selectVerifyNode(node));
  line.append(button);
  container.append(line);

  if (!open) return container;
  const children = document.createElement("div");
  children.className = "verify-tree-children";
  branchChildren.forEach((child) => {
    children.append(renderVerifyTreeNode(child, depth + 1, visibleSystemIds));
  });
  systemManifests.forEach(({ source, selection }) => {
    children.append(manifestRow(system, source, selection, depth + 1));
  });
  if (extras.length) {
    const unmatched = document.createElement("button");
    unmatched.type = "button";
    unmatched.className = "manifest-row unmatched-row";
    unmatched.style.setProperty("--tree-depth", depth + 1);
    unmatched.append(lamp("pink"));
    const name = document.createElement("span");
    name.className = "manifest-name";
    name.textContent = "Unmatched files";
    const detail = document.createElement("span");
    detail.className = "manifest-counts";
    detail.textContent = `${extras.length} Vault files do not match a desired title`;
    unmatched.append(name, detail);
    unmatched.addEventListener("click", () => selectVerifyNode(node));
    children.append(unmatched);
  }
  container.append(children);
  return container;
}

function renderVerifySystems() {
  const list = $("#verifySystems");
  if (!verifyTreeDirty) {
    syncVerifyTreeSelection();
    return;
  }
  const finish = (content) => {
    list.replaceChildren(content);
    verifyTreeDirty = false;
    syncVerifyTreeSelection();
  };
  if (["idle", "loading"].includes(selectionStatus)) {
    finish(verifyEmpty("Building the selected title set...", true));
    return;
  }
  if (selectionStatus === "error") {
    finish(verifyEmpty("The selected title set could not be built."));
    return;
  }
  if (manifestSourcesStatus === "loading" && !manifestSources.length) {
    finish(verifyEmpty("Reading the manifest directory...", true));
    return;
  }
  if (manifestSourcesStatus === "error" && !manifestSources.length) {
    finish(verifyEmpty("The manifest directory could not be read."));
    return;
  }

  const visibleSystemIds = visibleVerifySystemIds();
  const root = { id: allManifestsId, name: "All manifests", type: "root", children: systemTree.root };
  finish(renderVerifyTreeNode(root, 0, visibleSystemIds));
}

function syncVerifyTreeSelection() {
  $$("#verifySystems [data-verify-node]").forEach((element) => {
    const selectedNode = element.dataset.verifyNode === state.verifyNode;
    const manifest = element.dataset.verifyManifest;
    element.classList.toggle("active", selectedNode && (manifest
      ? manifest === state.verifyManifest
      : !state.verifyManifest));
  });
}

function platoPulseElement(compact = false) {
  const pulse = document.createElement("span");
  pulse.className = `plato-pulse${compact ? " compact" : ""}`;
  pulse.setAttribute("aria-hidden", "true");
  pulse.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
  return pulse;
}

function verifyEmpty(message, loading = false) {
  const empty = document.createElement("div");
  empty.className = `verify-empty${loading ? " loading" : ""}`;
  if (loading) {
    const copy = document.createElement("span");
    copy.className = "loading-message";
    copy.textContent = message;
    empty.append(platoPulseElement(), copy);
  } else {
    empty.textContent = message;
  }
  return empty;
}

async function loadManifestRelease(system, source) {
  const key = manifestKey(system, source.relativePath);
  if (manifestReleaseCache.has(key)) return manifestReleaseCache.get(key);
  if (manifestReleasePromises.has(key)) return manifestReleasePromises.get(key);
  const request = tauriJson("manifest_releases", {
    systemId: system.id,
    relativePath: source.relativePath
  }).then((releases) => {
    manifestReleaseCache.set(key, releases);
    verifyReleaseLists.clear();
    return releases;
  }).finally(() => manifestReleasePromises.delete(key));
  manifestReleasePromises.set(key, request);
  return request;
}

function releasesForManifest(system, source) {
  return manifestReleaseCache.get(manifestKey(system, source.relativePath)) || [];
}

function renderVerifyChoice() {
  syncVerifyTreeSelection();
  renderVerifyReleases();
  renderVerifyOrganizer();
  renderLoadingActivity();
  verifyContentDirty = false;
}

async function selectManifest(system, source) {
  const systemId = systemNodeId(system);
  state.verifyNode = systemId;
  state.verifyManifest = source.relativePath;
  state.organizerStage = "unscanned";
  manifestReleaseStatus = source.present ? "loading" : "missing";
  renderVerifyChoice();
  if (!source.present) return;
  try {
    await loadManifestRelease(system, source);
    if (state.verifyNode !== systemId || state.verifyManifest !== source.relativePath) return;
    manifestReleaseStatus = "ready";
  } catch (error) {
    console.error(error);
    manifestReleaseStatus = "error";
  }
  renderVerifyReleases();
  renderLoadingActivity();
}

async function selectVerifyNode(node) {
  state.verifyNode = node.id;
  state.verifyManifest = null;
  state.organizerStage = "unscanned";
  const system = systemForTreeNode(node);
  if (!system || selectionStatus !== "ready") {
    manifestReleaseStatus = selectionStatus === "ready" ? "ready" : "idle";
    renderVerifyChoice();
    return;
  }

  const nodeId = node.id;
  manifestReleaseStatus = "loading";
  renderVerifyChoice();
  try {
    rebuildVerifyIndex();
    const selectedSources = (verifyManifests.get(system.id)?.selected || [])
      .map(({ source }) => source)
      .filter((source) => source.present);
    for (const source of selectedSources) {
      await loadManifestRelease(system, source);
      if (state.verifyNode !== nodeId || state.verifyManifest) return;
    }
    manifestReleaseStatus = "ready";
  } catch (error) {
    console.error(error);
    manifestReleaseStatus = "error";
  }
  renderVerifyReleases();
  renderLoadingActivity();
}

function currentVerifyReleases() {
  const selectedSystems = verifySystems();
  const system = selectedVerifySystem();
  if (!selectedSystems.length) return [];
  const cacheKey = `${state.verifyNode || ""}\u0000${state.verifyManifest || ""}`;
  if (verifyReleaseLists.has(cacheKey)) return verifyReleaseLists.get(cacheKey);
  if (state.verifyManifest && system) {
    rebuildVerifyIndex();
    const source = verifySources.get(state.verifyManifest);
    const releases = source ? releasesForManifest(system, source) : [];
    verifyReleaseLists.set(cacheKey, releases);
    return releases;
  }
  if (!system) {
    const selectedSystemNames = new Set(selectedSystems.map((candidate) => candidate.name));
    const releases = [];
    for (const title of desiredTitles) {
      if (!selectedSystemNames.has(title.system)) continue;
      releases.push({
        title: title.title,
        description: title.title,
        system: title.system,
        selected: true
      });
      if (releases.length === 300) break;
    }
    verifyReleaseLists.set(cacheKey, releases);
    return releases;
  }
  const merged = new Map(selectedTitlesForSystems(selectedSystems).map((title) => [
    `${title.system}\u0000${normalizedWords(title.title)}`,
    { title: title.title, description: title.title, system: title.system, selected: true }
  ]));
  if (system) {
    selectedManifestsForSystem(system).forEach((manifest) => {
      const source = verifySources.get(manifest.relativePath);
      if (!source) return;
      releasesForManifest(system, source).forEach((release) => {
        const key = `${system.name}\u0000${normalizedWords(release.title)}`;
        if (!release.selected && !merged.has(key)) merged.set(key, { ...release, system: system.name });
      });
    });
  }
  const releases = [...merged.values()].sort((a, b) => a.title.localeCompare(b.title)
    || a.system.localeCompare(b.system));
  verifyReleaseLists.set(cacheKey, releases);
  return releases;
}

function renderVerifyReleases() {
  const node = verifyNode();
  const selectedSystems = verifySystems();
  rebuildVerifyIndex();
  const source = verifySources.get(state.verifyManifest);
  $("#verifyReleaseTitle").textContent = state.verifyManifest || node?.name || "Select a system or manifest";

  const list = $("#verifyReleases");
  list.replaceChildren();
  if (["idle", "loading"].includes(selectionStatus)) {
    $("#verifyReleaseTitle").textContent = node?.name || "Building selection";
    $("#verifyReleaseSummary").textContent = "Selecting desired titles in the background.";
    list.append(verifyEmpty("Release decisions will appear when selection is ready.", true));
    return;
  }
  if (selectionStatus === "error") {
    $("#verifyReleaseTitle").textContent = node?.name || "Selection unavailable";
    $("#verifyReleaseSummary").textContent = "The selected title set could not be built.";
    list.append(verifyEmpty("Release decisions are unavailable."));
    return;
  }
  if (!node) {
    $("#verifyReleaseSummary").textContent = "Selection decisions will appear here.";
    list.append(verifyEmpty("Choose any hierarchy node to inspect its releases."));
    return;
  }
  const releasesLoading = manifestReleaseStatus === "loading";
  if (releasesLoading && state.verifyManifest) {
    $("#verifyReleaseSummary").textContent = "Reading release decisions...";
    list.append(verifyEmpty("Reading releases from the selected manifest set...", true));
    return;
  }
  if (manifestReleaseStatus === "missing") {
    $("#verifyReleaseSummary").textContent = "Archivist expects this manifest, but it is missing.";
    list.append(verifyEmpty("Add the expected manifest to the manifest directory."));
    return;
  }
  if (manifestReleaseStatus === "error") {
    $("#verifyReleaseSummary").textContent = "The releases could not be read.";
    list.append(verifyEmpty("The manifest could not be parsed for this system."));
    return;
  }

  const releases = currentVerifyReleases();
  const manifests = selectedManifestsForSystems(selectedSystems);
  const selected = selectedSystems.reduce((total, system) =>
    total + selectedTitlesForSystem(system).length, 0);
  const discarded = manifests.reduce((total, manifest) =>
    total + Math.max(0, manifest.described - manifest.wanted), 0);
  $("#verifyReleaseSummary").textContent = releasesLoading
    ? `${selected} selected · reading discarded decisions...`
    : source
    ? source.selected
      ? `${releases.length} described · ${releases.filter((release) => release.selected).length} selected`
      : `${releases.length} described · manifest excluded wholesale`
    : `${new Set(manifests.map((manifest) => manifest.relativePath)).size} manifests · ${selected} selected · ${discarded} discarded`;
  const filtered = releases.filter((release) =>
    state.verifyReleaseFilter === "all"
      || (state.verifyReleaseFilter === "selected") === release.selected);
  const filteredTotal = selectedVerifySystem()
    ? filtered.length
    : state.verifyReleaseFilter === "discarded" ? 0 : selected;
  if (!filtered.length) {
    if (releasesLoading) {
      list.append(verifyEmpty("Reading discarded decisions...", true));
      return;
    }
    const parentHasDiscarded = !selectedVerifySystem()
      && state.verifyReleaseFilter === "discarded"
      && discarded;
    list.append(verifyEmpty(parentHasDiscarded
      ? "Choose a system or manifest to inspect discarded releases."
      : "No releases match this filter."));
    return;
  }
  const fragment = document.createDocumentFragment();
  filtered.slice(0, 300).forEach((release) => {
    const row = document.createElement("div");
    row.className = `release-row${release.selected ? " selected" : ""}`;
    row.append(lamp(release.selected ? "green" : "dim"));
    const copy = document.createElement("span");
    copy.className = "release-name";
    copy.textContent = release.title;
    const detailText = release.description && release.description !== release.title
      ? release.description
      : selectedSystems.length > 1 ? release.system : "";
    if (detailText) {
      const detail = document.createElement("small");
      detail.className = "release-detail";
      detail.textContent = detailText;
      copy.append(detail);
    }
    const status = document.createElement("span");
    status.className = "release-state";
    status.textContent = release.selected ? "Selected" : "Discarded";
    row.append(copy, status);
    fragment.append(row);
  });
  list.append(fragment);
  if (filteredTotal > 300) {
    const limit = document.createElement("div");
    limit.className = "release-limit";
    limit.textContent = `${number.format(filteredTotal - 300)} more releases`;
    list.append(limit);
  }
  if (!selectedVerifySystem() && state.verifyReleaseFilter !== "selected" && discarded) {
    const detail = document.createElement("div");
    detail.className = "release-limit";
    detail.textContent = "Choose a system or manifest to inspect discarded releases.";
    list.append(detail);
  }
  if (releasesLoading) {
    list.append(verifyEmpty("Reading discarded decisions...", true));
  }
}

async function loadVerifyData() {
  if (selectionStatus !== "ready" || manifestSourcesStatus !== "idle") return;
  manifestSourcesStatus = "loading";
  verifyTreeDirty = true;
  verifyContentDirty = true;
  renderVerify();
  try {
    manifestSources = (await tauriInvoke("manifest_sources"))
      .filter((source) => digestManifestPath(source.relativePath));
    manifestSourcesStatus = "ready";
    invalidateVerifyData();
  } catch (error) {
    console.error(error);
    manifestSourcesStatus = "error";
    verifyTreeDirty = true;
    verifyContentDirty = true;
  }
  renderVerify();
}

async function loadIntake(path = "") {
  state.intakePath = path;
  state.organizerStage = "unscanned";
  intakeStatus = "loading";
  renderVerifyOrganizer();
  try {
    intakeEntries = await tauriInvoke("intake_entries", { relativePath: path || null });
    intakeStatus = "ready";
  } catch (error) {
    console.error(error);
    intakeStatus = "error";
  }
  renderVerifyOrganizer();
}

function intakeColour(entry, selectedSystems) {
  if (entry.directory || selectionStatus !== "ready") return "dim";
  if (fileMatchesSelection(selectedSystems, entry)) return "blue";
  if (fileMatchesSelection(systems, entry)) return "accent";
  return "dim";
}

function renderOrganizerActions(node) {
  const scanLoaded = state.organizerStage !== "unscanned";
  const matchesConfirmed = state.organizerStage === "matched";
  const viewsReady = Boolean(node)
    && selectionStatus === "ready"
    && vaultStatus === "ready"
    && intakeStatus === "ready";

  $("#organizerStage").textContent = matchesConfirmed
    ? "Matches confirmed"
    : scanLoaded ? "Scan loaded" : "Awaiting scan";
  $("#scanFiles").textContent = scanLoaded ? "Rescan" : "Scan";
  $("#scanFiles").disabled = !viewsReady;
  $("#matchFiles").textContent = matchesConfirmed ? "Rematch" : "Match";
  $("#matchFiles").disabled = !viewsReady || !scanLoaded;
  $("#moveFiles").hidden = !matchesConfirmed;
  $("#moveFiles").disabled = !viewsReady;
}

function renderVerifyOrganizer() {
  renderLoadingActivity();
  const node = verifyNode();
  const selectedSystems = verifySystems();
  renderOrganizerActions(node);
  $("#organizerSystem").textContent = node?.name || "Select a system or group";
  const selectedVaultFiles = vaultFilesForSystems(selectedSystems);
  $("#organizerVaultCount").textContent = vaultStatus === "ready"
    ? `${number.format(selectedVaultFiles.length)} files`
    : vaultStatus === "error" ? "Unavailable" : "Loading";
  const vault = $("#organizerVault");
  vault.replaceChildren();
  if (!node) {
    vault.append(verifyEmpty("Choose a hierarchy node."));
  } else if (["idle", "loading"].includes(vaultStatus)) {
    vault.append(verifyEmpty("Reading Vault...", true));
  } else if (vaultStatus === "error") {
    vault.append(verifyEmpty("The Vault could not be read."));
  }
  selectedVaultFiles.forEach((file) => {
    const matched = fileMatchesSelection(selectedSystems, file);
    const colour = selectionStatus === "ready" ? matched ? "green" : "pink" : "dim";
    vault.append(organizerFileRow(file.fileName, file.path, colour));
  });
  if (node && vaultStatus === "ready" && !selectedVaultFiles.length) {
    vault.append(verifyEmpty("No Vault files for this selection."));
  }

  $("#organizerIntakePath").textContent = state.intakePath ? `/${state.intakePath}` : "/";
  const intake = $("#organizerIntake");
  intake.replaceChildren();
  if (intakeStatus === "loading") {
    intake.append(verifyEmpty("Reading Intake directory...", true));
    return;
  }
  if (intakeStatus === "error") {
    intake.append(verifyEmpty("The Intake directory could not be read."));
    return;
  }
  if (state.intakePath) {
    const parent = state.intakePath.split("/").slice(0, -1).join("/");
    const row = organizerFileRow("..", "Parent directory", "dim", true);
    row.addEventListener("click", () => loadIntake(parent));
    intake.append(row);
  }
  intakeEntries.forEach((entry) => {
    const row = organizerFileRow(
      entry.name,
      entry.directory ? "Directory" : entry.relativePath,
      intakeColour(entry, selectedSystems),
      entry.directory
    );
    if (entry.directory) row.addEventListener("click", () => loadIntake(entry.relativePath));
    intake.append(row);
  });
}

function organizerFileRow(name, detail, colour, directory = false) {
  const row = document.createElement("div");
  row.className = `organizer-file-row${directory ? " directory" : ""}`;
  if (directory) {
    row.dataset.controller = "";
    row.tabIndex = 0;
    row.setAttribute("role", "button");
  }
  row.append(lamp(colour));
  const copy = document.createElement("span");
  copy.className = "organizer-file-name";
  copy.textContent = name;
  const path = document.createElement("small");
  path.className = "organizer-file-detail";
  path.textContent = detail;
  copy.append(path);
  row.append(copy);
  return row;
}

function renderVerify() {
  $$('[data-manifest-filter]').forEach((button) => {
    button.classList.toggle("active", button.dataset.manifestFilter === state.verifyManifestFilter);
    button.disabled = selectionStatus !== "ready";
  });
  $$('[data-release-filter]').forEach((button) => {
    button.classList.toggle("active", button.dataset.releaseFilter === state.verifyReleaseFilter);
  });
  renderVerifySystems();
  renderVerifyReleases();
  renderVerifyOrganizer();
  renderLoadingActivity();
  verifyContentDirty = false;
}

function nodes() {
  if (state.subject === "systems") return systemTree.nodes;
  if (state.subject === "network") return Object.fromEntries(networkNodes.map((node) => [node.id, node]));
  return Object.fromEntries(gameNodes.map((node) => [node.id, node]));
}

function currentRootIds() {
  if (state.subject === "systems") return systemTree.root;
  if (state.subject === "network") return networkNodes.map((node) => node.id);
  return gameNodes.map((node) => node.id);
}

function timelineDomain(subject = state.subject) {
  const items = subject === "systems"
    ? Object.values(systemTree.nodes)
    : gameNodes;
  if (!items.length) return { ...initialTimelineDomain };
  const min = Math.min(...items.map((node) => node.year));
  const max = Math.max(...items.map((node) => node.year));
  const pad = Math.max(1, (max - min) * .2);
  return {
    min: min - pad,
    max: max + pad
  };
}

function resetTimelineWindow() {
  const domain = timelineDomain();
  state.yearMin = domain.min;
  state.yearMax = domain.max;
}

function clampTimelineWindow(domain = timelineDomain()) {
  const windowWidth = state.yearMax - state.yearMin;
  const domainWidth = domain.max - domain.min;
  if (windowWidth >= domainWidth) {
    state.yearMin = domain.min;
    state.yearMax = domain.max;
    return;
  }
  state.yearMin = clamp(state.yearMin, domain.min, domain.max - windowWidth);
  state.yearMax = state.yearMin + windowWidth;
}

function currentNode() {
  return state.selected ? nodes()[state.selected] : null;
}

function parentOf(id) {
  if (state.subject !== "systems") return null;
  return systemTree.nodes[id]?.parent || null;
}

function pathTo(id) {
  if (!id) return [];
  const path = [];
  for (let current = id; current; current = parentOf(current)) path.unshift(current);
  return path;
}

function visibleIds() {
  if (state.subject !== "systems") return currentRootIds();
  const ids = new Set(systemTree.root);

  state.open.forEach((id) => {
    const node = nodes()[id];
    if (!node) return;
    const parent = parentOf(id);
    pathTo(id).forEach((pathId) => ids.add(pathId));
    (parent ? nodes()[parent].children : []).forEach((sibling) => ids.add(sibling));
    (node.children || []).forEach((child) => ids.add(child));
  });

  return [...ids];
}

function visibleNodes() {
  const items = orderNodes(visibleIds()
    .map((id) => nodes()[id])
    .filter(Boolean));
  return state.layout === "timeline"
    ? items.filter((node) => node.year <= state.yearMax + 4 && (node.endYear ?? node.year) >= state.yearMin - 4)
    : items;
}

function unitsSortValue(node) {
  return typeof node.unitsSold === "number" ? node.unitsSold : -1;
}

function orderCompare(a, b) {
  if (state.order === "most-titles") return titleCount(b) - titleCount(a) || a.year - b.year || a.name.localeCompare(b.name);
  if (state.order === "most-units") return unitsSortValue(b) - unitsSortValue(a) || a.year - b.year || a.name.localeCompare(b.name);
  return a.year - b.year || a.name.localeCompare(b.name);
}

function orderNodes(items) {
  return [...items].sort(orderCompare);
}

function gameDepth(id, seen = new Set()) {
  if (seen.has(id)) return 0;
  const nextSeen = new Set(seen).add(id);
  const parents = gameLinks.filter(([, target]) => target === id).map(([source]) => source);
  return parents.length
    ? 1 + Math.max(...parents.map((parent) => gameDepth(parent, nextSeen)))
    : 0;
}

function timelineDepth(node) {
  if (state.subject === "systems") return pathTo(nodeKey(node)).length - 1;
  return gameDepth(node.id);
}

function timelineStack(items) {
  if (state.subject === "systems") {
    const included = new Set(items.map(nodeKey));
    const ordered = [];
    const visit = (id) => {
      const node = systemTree.nodes[id];
      if (!node) return;
      if (included.has(id)) ordered.push(node);
      (node.children || [])
        .map((child) => systemTree.nodes[child])
        .filter(Boolean)
        .sort(orderCompare)
        .forEach((child) => visit(nodeKey(child)));
    };
    systemTree.root
      .map((id) => systemTree.nodes[id])
      .filter(Boolean)
      .sort(orderCompare)
      .forEach((node) => visit(nodeKey(node)));
    return ordered;
  }
  return [...items].sort((a, b) => timelineDepth(a) - timelineDepth(b) || orderCompare(a, b));
}

function timelineLayoutContext(items, height) {
  const activeRows = state.subject === "systems" ? rows : gameRows;
  const rowBounds = timelineRows(items, height);
  const rowStacks = new Map();

  activeRows.forEach((row) => {
    const rowItems = items.filter((item) => item.row === row);
    rowStacks.set(row, timelineStack(rowItems));
  });

  return { rowBounds, rowStacks };
}

function rectOf(element) {
  const rect = element.getBoundingClientRect();
  return { width: rect.width || 900, height: rect.height || 520 };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scale(value, inMin, inMax, outMin, outMax) {
  return outMin + clamp((value - inMin) / Math.max(1, inMax - inMin), 0, 1) * (outMax - outMin);
}

function scaleRaw(value, inMin, inMax, outMin, outMax) {
  return outMin + (value - inMin) / Math.max(1, inMax - inMin) * (outMax - outMin);
}

function rotatePoint(point, angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

function setGraphTransformAround(screen, world, zoom, rotation = graph.rotation) {
  const rotated = rotatePoint({ x: world.x * zoom, y: world.y * zoom }, rotation);
  graph.zoom = zoom;
  graph.rotation = rotation;
  graph.panX = screen.x - rotated.x;
  graph.panY = screen.y - rotated.y;
}

function shortText(value, max = 22) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function fitText(ctx, value, maxWidth) {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let low = 1;
  let high = value.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (ctx.measureText(`${value.slice(0, middle)}...`).width <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${value.slice(0, low)}...`;
}

function timelineDensityMetrics() {
  const density = clamp(state.timelineDensity, 0, 1);
  return {
    cursorTop: 48 + density * 10,
    rowBase: 48 + density * 20,
    rowGap: 34 + density * 22,
    rowMinimum: 72 + density * 24,
    slotTop: 22 + density * 12,
    categoryHeight: 30 + density * 12,
    cardHeight: 28 + density * 12,
    outerMargin: 6 + density * 6,
    fitPadding: 14 + density * 10
  };
}

function nodeSize(node, timelineWidth = graph.scene?.width) {
  const metrics = timelineDensityMetrics();
  if (node.type === "category" || node.type === "type" || node.type === "era") {
    const baseWidth = 190;
    const width = state.layout === "timeline" && Number.isFinite(timelineWidth) && Number.isFinite(node.endYear)
      ? Math.max(
        baseWidth,
        scaleRaw(node.endYear, state.yearMin, state.yearMax, 110, timelineWidth - 72)
          - scaleRaw(node.year, state.yearMin, state.yearMax, 110, timelineWidth - 72)
          + 178
      )
      : baseWidth;
    return { width, height: state.layout === "timeline" ? metrics.categoryHeight : 42 };
  }
  return { width: 178, height: state.layout === "timeline" ? metrics.cardHeight : 40 };
}

function nodeRect(node, position, padding = 8) {
  const size = nodeSize(node);
  const scaleValue = position.scale || 1;
  const width = size.width * scaleValue;
  const height = size.height * scaleValue;
  return {
    left: position.x - width / 2 - padding,
    right: position.x + width / 2 + padding,
    top: position.y - height / 2 - padding,
    bottom: position.y + height / 2 + padding
  };
}

function timelinePlot(width, height) {
  return { left: 110, right: width - 72, top: 34, bottom: height - 50 };
}

function timelineScreenPoint(point) {
  return {
    x: point.x,
    y: point.y * graph.zoom + graph.panY
  };
}

function timelineWorldBounds(bounds) {
  return {
    left: bounds.left,
    right: bounds.right,
    top: (bounds.top - graph.panY) / graph.zoom,
    bottom: (bounds.bottom - graph.panY) / graph.zoom
  };
}

function timelineContentExtents(scene = graph.scene, items = scene?.items) {
  if (!scene || !items?.length) return null;
  const margin = state.layout === "timeline" ? timelineDensityMetrics().outerMargin : 12;
  const rects = items.map((node) => nodeRect(node, scene.targets.get(nodeKey(node)), margin));
  return {
    left: rects.reduce((edge, rect) => rect.left < edge.left ? rect : edge),
    right: rects.reduce((edge, rect) => rect.right > edge.right ? rect : edge),
    top: rects.reduce((edge, rect) => rect.top < edge.top ? rect : edge),
    bottom: rects.reduce((edge, rect) => rect.bottom > edge.bottom ? rect : edge)
  };
}

function clampTimelinePanAxis(current, viewportStart, viewportEnd, contentStart, contentEnd, zoom, margin) {
  const usableSize = viewportEnd - viewportStart - margin * 2;
  const contentSize = (contentEnd - contentStart) * zoom;
  if (contentSize <= usableSize) {
    return (viewportStart + viewportEnd - (contentStart + contentEnd) * zoom) / 2;
  }
  return clamp(
    current,
    viewportStart + margin - contentEnd * zoom,
    viewportEnd - margin - contentStart * zoom
  );
}

function clampTimelinePan(scene = graph.scene) {
  const extents = timelineContentExtents(scene);
  if (!extents || !scene) return;
  const plot = timelinePlot(scene.width, scene.height);
  const margin = 18;
  graph.panX = 0;
  graph.panY = clampTimelinePanAxis(
    graph.panY,
    plot.top,
    plot.bottom,
    extents.top.top,
    extents.bottom.bottom,
    graph.zoom,
    margin
  );
}

function fitTimelineToContent(scene = graph.scene, items = scene?.items) {
  const extents = timelineContentExtents(scene, items);
  if (!extents || !scene) return;
  const plot = timelinePlot(scene.width, scene.height);
  const padding = timelineDensityMetrics().fitPadding;
  const bounds = {
    left: extents.left.left,
    right: extents.right.right,
    top: extents.top.top,
    bottom: extents.bottom.bottom
  };
  graph.zoom = 1;
  graph.panX = 0;
  const availableHeight = plot.bottom - plot.top - padding * 2;
  const contentHeight = (bounds.bottom - bounds.top) * graph.zoom;
  graph.panY = contentHeight <= availableHeight
    ? (plot.top + plot.bottom - (bounds.top + bounds.bottom) * graph.zoom) / 2
    : plot.top + padding - bounds.top * graph.zoom;
  clampTimelinePan(scene);
  redrawCanvas();
}

function resetAndFitTimeline() {
  resetTimelineWindow();
  graph.zoom = 1;
  graph.panX = 0;
  graph.panY = 0;
  renderExplore();
  fitTimelineToContent();
}

function rectContainedBy(rect, bounds) {
  return rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom;
}

function timelineNodeVisible(node, position, bounds) {
  if (!position) return false;
  const rect = nodeRect(node, position, 0);
  return rect.right >= bounds.left && rect.left <= bounds.right && rect.bottom >= bounds.top && rect.top <= bounds.bottom;
}

function timelineRows(items, height) {
  const activeRows = state.subject === "systems" ? rows : gameRows;
  const metrics = timelineDensityMetrics();
  let cursor = metrics.cursorTop;

  return new Map(activeRows.map((row) => {
    const rowItems = items.filter((item) => item.row === row);
    const bandHeight = Math.max(metrics.rowMinimum, metrics.rowBase + Math.max(1, rowItems.length) * metrics.rowGap);
    const bounds = {
      top: cursor,
      bottom: cursor + bandHeight,
      center: cursor + bandHeight / 2
    };
    cursor += bandHeight;
    return [row, bounds];
  }));
}

function timelinePosition(node, index, items, width, height, context = timelineLayoutContext(items, height)) {
  const key = nodeKey(node);
  const bounds = context.rowBounds.get(node.row);
  const siblings = context.rowStacks.get(node.row) || [];
  const siblingIndex = Math.max(0, siblings.findIndex((item) => nodeKey(item) === key));
  const yearX = scaleRaw(node.year, state.yearMin, state.yearMax, 110, width - 72);
  const x = yearX + nodeSize(node, width).width / 2;

  const metrics = timelineDensityMetrics();
  const slotTop = (bounds?.top || metrics.cursorTop) + metrics.slotTop;
  const y = slotTop + siblingIndex * metrics.rowGap;
  return {
    x,
    y
  };
}

function networkPosition(node, index, items, width, height) {
  const key = nodeKey(node);
  const activeRows = state.subject === "network" ? networkRows : state.subject === "systems" ? rows : gameRows;
  const angle = (index / Math.max(1, items.length)) * Math.PI * 2;
  const focused = key === state.selected || state.open.has(key);
  const rowIndex = activeRows.indexOf(node.row);
  const radius = focused ? 0 : Math.min(width, height) * (.23 + Math.max(0, rowIndex) * .025);
  return {
    x: width * .5 + Math.cos(angle) * radius,
    y: height * .5 + Math.sin(angle) * radius
  };
}

function treePosition(node, index, items, width, height) {
  const key = nodeKey(node);
  const depth = state.subject === "games" ? gameDepth(node.id) : pathTo(key).length - 1;
  const byDepth = items.filter((item) => (state.subject === "games" ? gameDepth(item.id) : pathTo(nodeKey(item)).length - 1) === depth);
  const siblingIndex = Math.max(0, byDepth.findIndex((item) => nodeKey(item) === key));
  return {
    x: byDepth.length <= 1
      ? width * .5
      : scale(siblingIndex, 0, byDepth.length - 1, 140, width - 140),
    y: 78 + depth * 132
  };
}

function treeFocusId(targets) {
  return state.selected && targets.has(state.selected)
    ? state.selected
    : [...state.open].reverse().find((id) => targets.has(id));
}

function treeBounds(items, targets, padding = 18) {
  return items
    .map((node) => nodeRect(node, targets.get(nodeKey(node)), padding))
    .reduce((acc, rect) => ({
      left: Math.min(acc.left, rect.left),
      right: Math.max(acc.right, rect.right),
      top: Math.min(acc.top, rect.top),
      bottom: Math.max(acc.bottom, rect.bottom)
    }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
}

function treeFitScale(items, targets, width, height) {
  const bounds = treeBounds(items, targets);
  const xScale = (width - 144) / Math.max(1, bounds.right - bounds.left);
  const yScale = (height - 96) / Math.max(1, bounds.bottom - bounds.top);
  return clamp(Math.min(1, xScale, yScale), .52, 1);
}

function treePanLimits(items, targets, height, zoom = graph.zoom) {
  const margin = 48;
  const bounds = treeBounds(items, targets);
  const min = height - margin - bounds.bottom * zoom;
  const max = margin - bounds.top * zoom;
  const center = (height - (bounds.top + bounds.bottom) * zoom) / 2;
  return min <= max ? { min, max } : { min: center, max: center };
}

function clampTreePan(value, scene = graph.scene) {
  if (!scene) return value;
  const limits = treePanLimits(scene.items, scene.targets, scene.height);
  return clamp(value, limits.min, limits.max);
}

function centerTreeOnFocus(items, targets, height) {
  const focus = treeFocusId(targets);
  const bounds = treeBounds(items, targets);
  graph.zoom = treeFitScale(items, targets, graph.scene?.width || 900, height);
  graph.panX = ((graph.scene?.width || 900) - (bounds.left + bounds.right) * graph.zoom) / 2;
  graph.panY = focus
    ? clampTreePan(height / 2 - targets.get(focus).y * graph.zoom, { items, targets, height })
    : clampTreePan(graph.panY, { items, targets, height });
}

function targetPosition(node, index, items, width, height, context) {
  if (state.layout === "timeline") return timelinePosition(node, index, items, width, height, context);
  if (state.layout === "tree") return treePosition(node, index, items, width, height);
  return networkPosition(node, index, items, width, height);
}

function activeLinks(items) {
  const ids = new Set(items.map(nodeKey));
  if (state.subject === "systems") return items
    .map((node) => [parentOf(nodeKey(node)), nodeKey(node)])
    .filter(([source, target]) => source && ids.has(source) && ids.has(target));
  if (state.subject === "network") return networkLinks.filter(([source, target]) => ids.has(source) && ids.has(target));

  return gameLinks.filter(([source, target]) => ids.has(source) && ids.has(target));
}

function childOrigin(node, target) {
  const parent = parentOf(nodeKey(node));
  return parent
    ? graph.positions.get(parent) || graph.animation?.to.get(parent) || target
    : graph.positions.get([...state.open].at(-1)) || target;
}

function makeAnimation(items, targets) {
  const visible = new Set(items.map(nodeKey));
  const current = interpolatedPositions();
  const from = new Map();
  const to = new Map(targets);
  const entering = new Set();
  const exiting = new Set([...current.keys()].filter((id) => !visible.has(id)));

  items.forEach((node) => {
    const key = nodeKey(node);
    const target = targets.get(key);
    if (current.has(key)) {
      from.set(key, current.get(key));
    } else {
      from.set(key, childOrigin(node, target));
      entering.add(key);
    }
  });

  exiting.forEach((id) => {
    const node = nodes()[id];
    const start = current.get(id);
    if (!node || !start) return;
    from.set(id, start);
    to.set(id, childOrigin(node, start));
  });

  graph.animation = {
    from,
    to,
    final: targets,
    entering,
    exiting,
    started: performance.now(),
    duration: 220
  };
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function interpolatedPositions() {
  if (!graph.animation) return graph.positions;
  const raw = clamp((performance.now() - graph.animation.started) / graph.animation.duration, 0, 1);
  const eased = easeOutCubic(raw);
  const positions = new Map();

  graph.animation.to.forEach((target, id) => {
    const start = graph.animation.from.get(id) || target;
    const exiting = graph.animation.exiting.has(id);
    positions.set(id, {
      x: start.x + (target.x - start.x) * eased,
      y: start.y + (target.y - start.y) * eased,
      alpha: graph.animation.entering.has(id) ? eased : exiting ? 1 - eased : 1,
      scale: graph.animation.entering.has(id) ? .72 + eased * .28 : exiting ? 1 - eased * .28 : 1
    });
  });

  if (raw >= 1) {
    graph.positions = new Map([...graph.animation.final].map(([id, position]) => [id, { ...position }]));
    graph.animation = null;
  }

  return positions;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawNode(ctx, node, position, collapsed = false, hitTest = true) {
  const size = nodeSize(node);
  const scaleValue = position.scale || 1;
  const width = size.width * scaleValue;
  const height = size.height * scaleValue;
  const left = position.x - width / 2;
  const top = position.y - height / 2;
  const alpha = position.alpha ?? 1;
  const key = nodeKey(node);
  const selected = key === state.selected;

  if (hitTest) graph.hitboxes.push({ id: key, left, top, right: left + width, bottom: top + height });

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = selected ? 9 : 0;
  ctx.shadowColor = themeColours.canvasGlow;
  roundedRect(ctx, left, top, width, height, 3);
  ctx.fillStyle = collapsed ? themeColours.canvasNodeCollapsed : themeColours.canvasNode;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = selected ? themeColours.accent : collapsed ? themeColours.canvasNodeBorderCollapsed : themeColours.canvasNodeBorder;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = themeColours.accent;
  ctx.font = canvasFonts.monogram;
  ctx.textBaseline = "middle";
  ctx.fillText(node.type[0].toUpperCase(), left + 11, top + height / 2);

  if (state.subject !== "network" && state.showLamps) {
    ctx.fillStyle = vaultStatus === "ready"
      ? node.owned ? themeColours.green : themeColours.red
      : themeColours.canvasMuted;
    ctx.beginPath();
    ctx.arc(left + width - 14, top + height / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = themeColours.bg;
    ctx.stroke();
  }

  const contentLeft = left + 30;
  const contentRight = left + width - 28;
  const textWidth = Math.max(24, contentRight - contentLeft);
  ctx.fillStyle = themeColours.canvasText;
  ctx.font = canvasFonts.title;
  ctx.fillText(fitText(ctx, node.name, textWidth), contentLeft, top + height / 2);
  ctx.restore();
}

function drawTimelineAxes(ctx, width, height) {
  const activeRows = state.subject === "systems" ? rows : gameRows;
  const rowBounds = timelineRows(graph.scene.items, height);
  const plot = timelinePlot(width, height);
  const labelY = height - 24;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = canvasFonts.row;
  const span = state.yearMax - state.yearMin;
  const pixelsPerYear = (plot.right - plot.left) / Math.max(1, span);
  const minorStep = pixelsPerYear >= 3 ? 1 : 5;
  const majorStep = pixelsPerYear >= 5 ? 5 : pixelsPerYear >= 2 ? 10 : 25;
  const firstYear = Math.ceil(state.yearMin / minorStep) * minorStep;
  for (let year = firstYear; year <= Math.floor(state.yearMax); year += minorStep) {
    const x = timelineScreenPoint({
      x: scaleRaw(year, state.yearMin, state.yearMax, 110, width - 72),
      y: 0
    }).x;
    if (x < plot.left || x > plot.right) continue;
    const major = year % majorStep === 0;
    ctx.strokeStyle = major ? themeColours.canvasGrid : themeColours.canvasGridMinor;
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, plot.bottom);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = themeColours.canvasAxisText;
      ctx.textAlign = "center";
      ctx.fillText(year, x, labelY);
    }
  }

  activeRows.forEach((row, index) => {
    const bounds = rowBounds.get(row);
    const centerY = timelineScreenPoint({ x: 0, y: bounds?.center || 105 + index * 96 }).y;
    const boundaries = index === 0 ? [bounds?.top, bounds?.bottom] : [bounds?.bottom];
    ctx.strokeStyle = themeColours.canvasRow;
    boundaries
      .filter((y) => y !== undefined)
      .map((y) => timelineScreenPoint({ x: 0, y }).y)
      .filter((y) => y >= plot.top && y <= plot.bottom)
      .forEach((y) => {
        ctx.beginPath();
        ctx.moveTo(72, y);
        ctx.lineTo(width - 48, y);
        ctx.stroke();
      });
    if (centerY < plot.top || centerY > plot.bottom) return;
    ctx.fillStyle = themeColours.canvasAxisText;
    ctx.textAlign = "left";
    ctx.fillText(row.toUpperCase(), 18, centerY + 4);
  });
  ctx.restore();
}

function drawDotGrid(ctx, width, height) {
  ctx.save();
  ctx.fillStyle = themeColours.canvasDot;
  for (let x = 72; x < width - 48; x += 48) {
    for (let y = 52; y < height - 42; y += 48) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.restore();
}

function drawRoundedRoute(ctx, points, radius = 18) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1];
    const point = points[index];
    const next = points[index + 1];
    const inLength = Math.hypot(point.x - prev.x, point.y - prev.y);
    const outLength = Math.hypot(next.x - point.x, next.y - point.y);
    const corner = Math.min(radius, inLength * .45, outLength * .45);
    if (!corner) {
      ctx.lineTo(point.x, point.y);
      continue;
    }
    ctx.lineTo(point.x - (point.x - prev.x) / inLength * corner, point.y - (point.y - prev.y) / inLength * corner);
    ctx.quadraticCurveTo(point.x, point.y, point.x + (next.x - point.x) / outLength * corner, point.y + (next.y - point.y) / outLength * corner);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function nodeAnchor(node, position, side) {
  const size = nodeSize(node);
  const scaleValue = position.scale || 1;
  const width = size.width * scaleValue;
  const height = size.height * scaleValue;
  const radius = 3 * scaleValue;
  if (side === "bottom-left") return { x: position.x - width / 2 + radius + 2, y: position.y + height / 2 };
  if (side === "left-entry") return { x: position.x - width / 2, y: position.y - height / 2 + radius + 10 };
  return position;
}

function timelineLinkPoints(sourceNode, targetNode, sourcePosition, targetPosition) {
  const source = nodeAnchor(sourceNode, sourcePosition, "bottom-left");
  const target = nodeAnchor(targetNode, targetPosition, "left-entry");
  return [source, { x: source.x, y: target.y }, target];
}

function drawBezier(ctx, sourceNode, targetNode, a, b) {
  if (state.layout === "timeline") {
    drawRoundedRoute(ctx, timelineLinkPoints(sourceNode, targetNode, a, b), 5);
    return;
  }

  if (state.layout === "tree") {
    const midY = a.y + (b.y - a.y) * .52;
    drawRoundedRoute(ctx, [{ x: a.x, y: a.y }, { x: a.x, y: midY }, { x: b.x, y: midY }, { x: b.x, y: b.y }]);
    return;
  }

  const midX = a.x + (b.x - a.x) * .52;
  drawRoundedRoute(ctx, [{ x: a.x, y: a.y }, { x: midX, y: a.y }, { x: midX, y: b.y }, { x: b.x, y: b.y }]);
}

function pointInRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function segmentRectExit(a, b, rect) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const candidates = [];
  if (dx) {
    [rect.left, rect.right].forEach((x) => {
      const t = (x - a.x) / dx;
      const y = a.y + dy * t;
      if (t > 0 && t <= 1 && y >= rect.top && y <= rect.bottom) candidates.push({ t, x, y });
    });
  }
  if (dy) {
    [rect.top, rect.bottom].forEach((y) => {
      const t = (y - a.y) / dy;
      const x = a.x + dx * t;
      if (t > 0 && t <= 1 && x >= rect.left && x <= rect.right) candidates.push({ t, x, y });
    });
  }
  return candidates.sort((left, right) => left.t - right.t)[0];
}

function drawOffscreenArrow(ctx, link, sourceVisible, plot) {
  const points = timelineLinkPoints(link.source, link.target, link.a, link.b);
  if (!sourceVisible) points.reverse();
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (!pointInRect(from, plot) || pointInRect(to, plot)) continue;
    const exit = segmentRectExit(from, to, plot);
    if (!exit) return;
    const angle = Math.atan2(exit.y - from.y, exit.x - from.x);
    const size = 8 / Math.max(.01, graph.zoom);
    ctx.beginPath();
    ctx.moveTo(exit.x, exit.y);
    ctx.lineTo(exit.x - Math.cos(angle - Math.PI / 6) * size, exit.y - Math.sin(angle - Math.PI / 6) * size);
    ctx.lineTo(exit.x - Math.cos(angle + Math.PI / 6) * size, exit.y - Math.sin(angle + Math.PI / 6) * size);
    ctx.closePath();
    ctx.fillStyle = themeColours.canvasLink;
    ctx.fill();
    return;
  }
}

function drawVisibleLink(ctx, link, visibleTimelineNodes, plot) {
  if (state.layout !== "timeline") {
    drawBezier(ctx, link.source, link.target, link.a, link.b);
    return;
  }

  const sourceVisible = visibleTimelineNodes.has(nodeKey(link.source));
  const targetVisible = visibleTimelineNodes.has(nodeKey(link.target));
  if (!sourceVisible && !targetVisible) return;
  if (sourceVisible !== targetVisible) {
    ctx.save();
    ctx.setLineDash([]);
    drawBezier(ctx, link.source, link.target, link.a, link.b);
    drawOffscreenArrow(ctx, link, sourceVisible, plot);
    ctx.restore();
    return;
  }
  drawBezier(ctx, link.source, link.target, link.a, link.b);
}

function drawOccludedLinkDashes(ctx, items, positions, links, visibleTimelineNodes, plot) {
  const cards = items
    .filter((node) => (!visibleTimelineNodes || visibleTimelineNodes.has(nodeKey(node))) && positions.get(nodeKey(node)));
  if (!cards.length || !links.length) return;

  ctx.save();
  ctx.strokeStyle = themeColours.canvasLink;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([6, 5]);
  cards.forEach((card) => {
    const cardId = nodeKey(card);
    const rect = nodeRect(card, positions.get(cardId), 0);
    ctx.save();
    roundedRect(ctx, rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top, 3);
    ctx.clip();
    links
      .filter((link) => nodeKey(link.source) !== cardId && nodeKey(link.target) !== cardId)
      .forEach((link) => drawVisibleLink(ctx, link, visibleTimelineNodes, plot));
    ctx.restore();
  });
  ctx.restore();
}

function drawGraph() {
  const { canvas, ctx, items, links, width, height, dpr } = graph.scene;
  const positions = interpolatedPositions();
  const exitingNodes = [...(graph.animation?.exiting || [])]
    .map((id) => nodes()[id])
    .filter(Boolean);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  graph.hitboxes = [];
  if (state.layout === "timeline") drawTimelineAxes(ctx, width, height);
  else drawDotGrid(ctx, width, height);

  const plot = state.layout === "timeline" ? timelinePlot(width, height) : { left: 0, top: 0, right: width, bottom: height };
  const contentPlot = state.layout === "timeline" ? timelineWorldBounds(plot) : plot;
  const visibleTimelineNodes = state.layout === "timeline"
    ? new Set(items.filter((node) => timelineNodeVisible(node, positions.get(nodeKey(node)), contentPlot)).map(nodeKey))
    : null;

  ctx.save();
  const clipInset = state.layout === "timeline" ? 1 : 0;
  ctx.rect(
    plot.left + clipInset,
    plot.top + clipInset,
    plot.right - plot.left - clipInset * 2,
    plot.bottom - plot.top - clipInset * 2
  );
  ctx.clip();
  if (state.layout === "timeline") {
    ctx.translate(0, graph.panY);
    ctx.scale(1, graph.zoom);
  } else {
    ctx.translate(graph.panX, graph.panY);
    if (state.layout === "network") ctx.rotate(graph.rotation);
    ctx.scale(graph.zoom, graph.zoom);
  }
  ctx.strokeStyle = themeColours.canvasLink;
  ctx.lineWidth = 1.4;
  const itemById = new Map(items.map((node) => [nodeKey(node), node]));
  const linkData = links
    .map(([source, target]) => ({ source: itemById.get(source), target: itemById.get(target), a: positions.get(source), b: positions.get(target) }))
    .filter((link) => link.source && link.target && link.a && link.b);
  linkData.forEach((link) => drawVisibleLink(ctx, link, visibleTimelineNodes, contentPlot));

  items
    .filter((node) => !visibleTimelineNodes || visibleTimelineNodes.has(nodeKey(node)))
    .forEach((node) => drawNode(ctx, node, positions.get(nodeKey(node)), node.children?.length && !state.open.has(nodeKey(node))));
  exitingNodes
    .filter((node) => !visibleTimelineNodes || timelineNodeVisible(node, positions.get(nodeKey(node)), contentPlot))
    .forEach((node) => drawNode(ctx, node, positions.get(nodeKey(node)), false, false));
  drawOccludedLinkDashes(ctx, items, positions, linkData, visibleTimelineNodes, contentPlot);
  ctx.restore();
}

function animateGraph() {
  if (!graph.scene) {
    graph.frame = null;
    return;
  }

  drawGraph();
  graph.frame = graph.animation ? requestAnimationFrame(animateGraph) : null;
}

function requestGraphFrame() {
  if (!graph.frame) graph.frame = requestAnimationFrame(animateGraph);
}

function syncLampControls() {
  document.body.classList.toggle("lamps-hidden", !state.showLamps);
  $("#toggleLamps").setAttribute("aria-checked", String(state.showLamps));
  $("#toggleLamps").title = state.showLamps ? "Hide lamps" : "Show lamps";
}

function hasExploreData() {
  return currentRootIds().some((id) => nodes()[id]);
}

function startupPlaceholderCopy() {
  if (systemsStatus === "loading") return ["Loading systems", "Reading the system table."];
  if (systemsStatus === "error") return ["System data unavailable", "Restart Archivist to try again."];
  if (systemsStatus === "empty") return ["No system data", "The systems table is empty."];
  return null;
}

function explorePlaceholderCopy() {
  const startupCopy = startupPlaceholderCopy();
  if (startupCopy) return startupCopy;
  if (state.subject === "games") return ["No game genealogy data", "The backend has not provided this view yet."];
  if (state.subject === "network") return ["No network data", "The backend has not provided this view yet."];
  return ["No system data", "The systems table is empty."];
}

function placeholderHtml(title, detail, className = "placeholder-card") {
  return `
    <div class="${className}" role="status" aria-live="polite">
      <div class="placeholder-widget" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
        <i></i>
      </div>
      <div class="placeholder-copy">
        <strong>${title}</strong>
        <small>${detail}</small>
      </div>
    </div>`;
}

function placeholderElement(title, detail, className = "placeholder-card") {
  const template = document.createElement("template");
  template.innerHTML = placeholderHtml(title, detail, className);
  return template.content.firstElementChild;
}

function setExplorePlaceholder(show) {
  const placeholder = $("#explorePlaceholder");
  $(".canvas").classList.toggle("placeholder-active", show);
  placeholder.hidden = !show;
  if (!show) return;

  const [title, detail] = explorePlaceholderCopy();
  placeholder.querySelector("[data-placeholder-title]").textContent = title;
  placeholder.querySelector("[data-placeholder-detail]").textContent = detail;
}

function clearGraph(canvas, ctx) {
  hideNodeTooltip();
  if (graph.frame) cancelAnimationFrame(graph.frame);
  graph.frame = null;
  graph.scene = null;
  graph.positions = new Map();
  graph.animation = null;
  graph.targetKey = "";
  graph.hitboxes = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function renderExplore() {
  const timelineMode = state.layout === "timeline";
  const hasData = hasExploreData();
  $(".canvas-wrap").classList.toggle("timeline-mode", timelineMode);
  $(".timeline-footer").hidden = !timelineMode || !hasData;
  $("#exploreOrderControl").hidden = !hasData || state.subject !== "systems";
  const densityControl = $("#timelineDensityControl");
  const densityInput = $("#timelineDensity");
  densityControl.hidden = !timelineMode || !hasData;
  densityInput.value = String(Math.round(state.timelineDensity * 100));
  densityInput.setAttribute(
    "aria-valuetext",
    state.timelineDensity <= 0.05
      ? "Compact"
      : state.timelineDensity >= 0.95
        ? "Expanded"
        : `${Math.round(state.timelineDensity * 100)}% expanded`
  );
  syncLampControls();
  $("#exploreTitle").textContent = {
    systems: "System History",
    games: "Game Genealogies",
    network: "People and Studios"
  }[state.mode];
  $("#exploreSubtitle").textContent = {
    systems: "Timeline view for system families, generations, and hardware.",
    games: "Tree view for early game genre lineages.",
    network: "Network view for companies, studios, and significant people."
  }[state.mode];

  const canvas = $("#exploreCanvas");
  const { width, height } = rectOf(canvas);
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.floor(width * dpr);
  const pixelHeight = Math.floor(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext("2d", { alpha: true });

  setExplorePlaceholder(!hasData);
  if (!hasData) {
    state.selected = null;
    clearGraph(canvas, ctx);
    return;
  }

  const items = visibleNodes();
  const layoutContext = state.layout === "timeline" ? timelineLayoutContext(items, height) : null;
  const targets = new Map(items.map((node, index) => [nodeKey(node), targetPosition(node, index, items, width, height, layoutContext)]));
  const links = activeLinks(items);
  const layoutKey = [
    state.subject,
    state.layout,
    state.selected,
    [...state.open].sort().join(","),
    state.order,
    Math.round(width),
    Math.round(height),
    ...items.map(nodeKey)
  ].join("|");

  const targetChanged = layoutKey !== graph.targetKey;
  graph.scene = { canvas, ctx, items, targets, links, width, height, dpr };
  if (state.layout === "timeline") clampTimelinePan();
  if (state.layout === "tree") {
    if (targetChanged) centerTreeOnFocus(items, targets, height);
    else {
      const bounds = treeBounds(items, targets);
      graph.zoom = treeFitScale(items, targets, width, height);
      graph.panX = (width - (bounds.left + bounds.right) * graph.zoom) / 2;
      graph.panY = clampTreePan(graph.panY);
    }
  }
  if (targetChanged) {
    graph.targetKey = layoutKey;
    makeAnimation(items, targets);
  } else {
    graph.positions = new Map(targets);
    graph.animation = null;
  }
  if (timelineMode && window.__ARCHIVIST_FIT_INITIAL_VIEW && !window.__ARCHIVIST_INITIAL_VIEW_FITTED) {
    window.__ARCHIVIST_INITIAL_VIEW_FITTED = true;
    const frameIds = new Set(window.__ARCHIVIST_INITIAL_FRAME_NODES || []);
    const frameItems = frameIds.size
      ? items.filter((node) => frameIds.has(nodeKey(node)))
      : window.__ARCHIVIST_INITIAL_FRAME_ROW
        ? items.filter((node) => node.row === window.__ARCHIVIST_INITIAL_FRAME_ROW)
        : items;
    fitTimelineToContent(graph.scene, frameItems);
  }
  requestGraphFrame();
  if (timelineMode) renderScrollbar();
}

function setOrder(value) {
  state.order = value;
  $("#exploreOrderButton").textContent = orderLabels[value];
  $("#exploreOrderButton").setAttribute("aria-expanded", "false");
  $("#exploreOrderControl").classList.remove("open");
  $$("[data-order]").forEach((button) => button.setAttribute("aria-checked", String(button.dataset.order === value)));
  renderExplore();
}

function setExploreMode(mode) {
  hideNodeTooltip();
  const view = modeViews[mode];
  state.mode = mode;
  state.subject = view.subject;
  state.layout = view.layout;
  state.selected = null;
  state.open = new Set();
  graph.panX = 0;
  graph.panY = 0;
  graph.zoom = 1;
  graph.rotation = 0;
  graph.pointers.clear();
  graph.gesture = null;
  if (state.layout === "timeline") resetTimelineWindow();
  $$("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  switchView("explore");
}

function selectNode(id) {
  state.selected = id;
  renderExplore();
  renderDetail();
}

function toggleNode(id) {
  const node = nodes()[id];
  if (!node) return;
  const systemNode = state.subject === "systems" && node.type === "system";
  const gameNode = state.subject === "games" && node.type === "game";
  if (systemNode || gameNode) state.selected = id;
  else state.selected = null;

  if (state.subject === "systems" && node.children?.length) {
    state.open = new Set(state.open.has(id)
      ? [...state.open].filter((openId) => !pathTo(openId).includes(id))
      : [...state.open, id]);
  }
  if (state.selected && !visibleIds().includes(state.selected)) state.selected = null;

  renderExplore();
  renderDetail();
}

function renderDetail() {
  const node = currentNode();
  const showSystem = state.subject === "systems" && node?.type === "system";
  const showGame = state.subject === "games" && node?.type === "game";
  const showDetail = state.view === "explore" && (showSystem || showGame);
  showDrawer("explore", showDetail);
  if (!showDetail) renderedDetailId = "";
  if (!showDetail) return;
  const detailId = `${state.subject}:${nodeKey(node)}`;
  if (renderedDetailId === detailId) return;
  renderedDetailId = detailId;

  $("#launchTitles").querySelector("span").textContent = "View";
  $("#launchTitles").querySelector("small").textContent = showGame ? "Platforms" : "Titles";
  $("#verifyTitles").hidden = showGame;
  $("#launchTitles").style.gridColumn = showGame ? "1 / -1" : "";

  $("#detailTitle").textContent = showGame ? "Game" : "System";
  $("#contextTitle").textContent = showGame ? "Platforms" : "Emulation";
  const systemImage = nodeKey(node) === "apple-ii"
    ? `<div class="system-image has-photo"><img src="./assets/apple-ii.jpg" alt="Apple II computer and monitor"></div>`
    : `<div class="system-image">${node.name.split(/\s+/).slice(0, 3).map((word) => word[0]).join("")}</div>`;
  $("#detailCard").innerHTML = `
    ${systemImage}
    <div class="selected-name"><span>${node.name}</span></div>
    <dl class="detail-grid">
      <dt>${showGame ? "Lineage" : "Maker"}</dt><dd>${showGame ? node.row : makerName(node)}</dd>
      <dt>${showGame ? "Origin" : "Class"}</dt><dd>${showGame ? node.maker : node.row}</dd>
      <dt>Released</dt><dd>${node.year}</dd>
      <dt>${showGame ? "Descendants" : "Titles"}</dt><dd>${number.format(titleCount(node))}</dd>
      ${showSystem ? `<dt>Units sold</dt><dd>${formatUnits(node.unitsSold)}</dd>` : ""}
    </dl>`;
  const enabledEmulators = enabledEmulatorsForSystem(node);
  $("#contextRows").replaceChildren(...(showGame
    ? gamePortsForExploreNode(node).map((port) => miniRow(portReady(port) ? "green" : "red", portSystemName(port), [portYear(port), portEmulator(port)].filter(Boolean).join(" / ")))
    : emulatorsForSystem(node).map((name) => emulatorRow(name, name === defaultEmulator(node), enabledEmulators.has(name)))
  ));
}

function showDrawer(panel, open) {
  $(".app").classList.toggle("detail-hidden", !open);
  $("#detailSide").classList.toggle("empty", !open);
  $("#exploreDrawer").hidden = panel !== "explore";
  $("#launchDrawer").hidden = panel !== "launch";
}

function closeActiveDrawer() {
  if (state.view === "explore") {
    state.selected = null;
    renderedDetailId = "";
    showDrawer("explore", false);
    renderExplore();
    return;
  }
  if (state.view === "launch") {
    state.launchDrawerOpen = false;
    showDrawer("launch", false);
  }
}

function formatUnits(value) {
  if (typeof value !== "number") return "Unknown";
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 1 : 2).replace(/\.0+$/, "")}M sold`;
  return `${number.format(value)} sold`;
}

function miniRow(colour, label, value) {
  const row = document.createElement("div");
  row.className = "mini-row";
  row.innerHTML = `<span class="lamp ${colour}"></span><span>${label}</span><small>${value}</small>`;
  return row;
}

function starIcon() {
  return `<svg class="default-star" viewBox="0 0 16 16" aria-label="Default emulator" role="img"><path d="M8 1.8l1.8 3.7 4.1.6-3 2.9.7 4.1L8 11.2 4.4 13.1l.7-4.1-3-2.9 4.1-.6z"/></svg>`;
}

function emulatorRow(name, isDefault, isEnabled) {
  const row = miniRow(isEnabled ? "green" : "red", name, isEnabled ? "enabled" : "disabled");
  row.classList.toggle("disabled", !isEnabled);
  if (isDefault) row.querySelector("span:nth-child(2)").insertAdjacentHTML("beforeend", starIcon());
  return row;
}

function emulatorsForSystem(system) {
  return [...new Set([...(system.emulators || []), system.emulator])].filter(Boolean);
}

function enabledEmulatorsForSystem(system) {
  return new Set(emulatorsForSystem(system));
}

function emulatorLinkCount() {
  return Object.values(systemTree.nodes)
    .filter((node) => node.type === "system")
    .reduce((count, system) => count + emulatorsForSystem(system).length, 0);
}

function launchGameForExploreNode(node) {
  if (!node) return null;
  const nodeSlug = slug(node.name);
  return launchGames.find((game) => game.id === node.id)
    || launchGames.find((game) => game.id === nodeSlug || slug(game.title) === nodeSlug)
    || null;
}

function gamePortsForExploreNode(node) {
  return launchGameForExploreNode(node)?.ports || [];
}

function launchSystems() {
  return [...launchGames.reduce((systemsById, game) => {
    game.ports.forEach((port) => {
      const id = portSystemId(port);
      if (id && !systemsById.has(id)) systemsById.set(id, systemTree.nodes[id] || port);
    });
    return systemsById;
  }, new Map()).values()]
    .sort(compareLaunchSystems);
}

function launchSystemLabel(id) {
  return id ? systemTree.nodes[id]?.name || launchSystemName(launchSystems().find((system) => launchSystemId(system) === id)) || "Selected system" : "";
}

function launchSystemMenuHtml() {
  const query = state.launchSystemQuery.trim().toLowerCase();
  const systems = launchSystems().filter((item) => !query || launchSystemName(item).toLowerCase().includes(query));
  return `
    <button type="button" role="option" aria-selected="${!state.launchSystem}" data-launch-system="">All systems</button>
    ${systems.map((item) => `<button type="button" role="option" aria-selected="${launchSystemId(item) === state.launchSystem}" data-launch-system="${launchSystemId(item)}">${launchSystemName(item)}</button>`).join("")}
  `;
}

function launchVisibleGames() {
  const query = state.launchQuery.trim().toLowerCase();
  return launchGames.filter((game) => {
    const matchesSystem = !state.launchSystem || game.ports.some((port) => portSystemId(port) === state.launchSystem);
    const matchesQuery = !query || game.title.toLowerCase().includes(query);
    const matchesPlayable = !state.launchPlayableOnly || game.ports.some(portReady);
    return matchesSystem && matchesQuery && matchesPlayable;
  });
}

function selectedLaunchGame(games = launchVisibleGames()) {
  return games.find((game) => game.id === state.launchGame) || games[0] || null;
}

function selectedLaunchPort(game) {
  if (!game) return null;
  return game.ports.find((port) => portKey(port) === state.launchPort)
    || game.ports.find((port) => portSystemId(port) === state.launchPort)
    || game.ports.find((port) => portSystemId(port) === state.launchSystem)
    || game.ports[0];
}

function portKey(port) {
  return port?.path || portSystemId(port);
}

function portSystemId(port) {
  return port?.systemSlug || port?.systemId || null;
}

function portSystemName(port) {
  return port?.system || "Unknown system";
}

function portEmulator(port) {
  return port?.emulator || "Unconfigured";
}

function portReady(port) {
  return Boolean(port?.romPresent && port?.emulatorAvailable);
}

function portYear(port) {
  return Number(port?.systemYear ?? systemTree.nodes[portSystemId(port)]?.year) || null;
}

function portStatus(port) {
  if (portReady(port)) return "ready";
  if (port?.romPresent || port?.emulatorAvailable) return "partial";
  return "missing";
}

function statusColour(status) {
  return status === "ready" ? "green" : status === "partial" ? "blue" : "red";
}

function launchSystemId(item) {
  return item?.type === "system" ? systemNodeId(item) : item?.id || portSystemId(item);
}

function launchSystemName(item) {
  return item ? item.name || portSystemName(item) : "";
}

function launchSystemYear(item) {
  const id = launchSystemId(item);
  return Number(systemTree.nodes[id]?.year ?? item?.year) || null;
}

function compareLaunchSystems(a, b) {
  return (launchSystemYear(a) ?? Number.MAX_SAFE_INTEGER) - (launchSystemYear(b) ?? Number.MAX_SAFE_INTEGER)
    || launchSystemName(a).localeCompare(launchSystemName(b));
}

function compareLaunchPorts(a, b) {
  return (portYear(a) ?? Number.MAX_SAFE_INTEGER) - (portYear(b) ?? Number.MAX_SAFE_INTEGER)
    || portSystemName(a).localeCompare(portSystemName(b));
}

function compareLaunchGames(a, b) {
  if (state.launchOrder === "title") return a.title.localeCompare(b.title);
  const aYear = Math.min(...a.ports.map(portYear).filter(Boolean), Number.MAX_SAFE_INTEGER);
  const bYear = Math.min(...b.ports.map(portYear).filter(Boolean), Number.MAX_SAFE_INTEGER);
  const chronological = aYear - bYear || a.title.localeCompare(b.title);
  return state.launchOrder === "newest" ? -chronological : chronological;
}

function launchGroups(games) {
  if (state.launchGroup === "none") {
    return [{ id: "all", system: null, games: [...games].sort(compareLaunchGames), header: false }];
  }
  return [...games.reduce((groups, game) => {
    const groupSystems = state.launchSystem
      ? [systemTree.nodes[state.launchSystem] || game.ports.find((port) => portSystemId(port) === state.launchSystem)]
      : [...game.ports.reduce((systemsById, port) => {
        const id = portSystemId(port);
        if (id && !systemsById.has(id)) systemsById.set(id, systemTree.nodes[id] || port);
        return systemsById;
      }, new Map()).values()];
    groupSystems.filter(Boolean).forEach((system) => {
      const id = launchSystemId(system);
      if (!id) return;
      const group = groups.get(id);
      if (group) group.games.push(game);
      else groups.set(id, { id, system, games: [game] });
    });
    return groups;
  }, new Map()).values()]
    .sort((a, b) => {
      const chronological = compareLaunchSystems(a.system, b.system);
      return state.launchOrder === "newest" ? -chronological : chronological;
    })
    .map((group) => ({
      ...group,
      header: true,
      games: group.games.sort(state.launchOrder === "title" ? compareLaunchGames : (a, b) => a.title.localeCompare(b.title))
    }));
}

function launchGameReady(game) {
  return Boolean(game?.ports?.some(portReady));
}

function launchGameStatus(game, systemId = null) {
  const ports = systemId && systemId !== "all"
    ? game.ports.filter((port) => portSystemId(port) === systemId)
    : game.ports;
  if (ports.some(portReady)) return "ready";
  if (ports.some((port) => port.romPresent || port.emulatorAvailable)) return "partial";
  return "missing";
}

function gameInitials(title) {
  return title.split(/\s+/).filter((word) => !/^the$/i.test(word)).slice(0, 2).map((word) => word[0]).join("");
}

function portShot(port) {
  return `<div class="port-shot">${portSystemName(port).split(/\s+/).slice(0, 2).map((word) => word[0]).join("")}</div>`;
}

function gameCardMeta(game) {
  return portEmulator(game.ports[0]);
}

function launchPlaceholderCopy() {
  if (["idle", "loading"].includes(selectionStatus)) return ["Loading catalogue", "Selecting canonical games."];
  if (selectionStatus === "error") return ["Catalogue unavailable", "The canonical game selection could not be read."];
  if (!launchGames.length) return ["No launch titles", "No canonical games are selected."];
  return ["No matching titles", "Adjust the system, search, or playable filter."];
}

function renderLaunchCards(games = null) {
  if (games !== null) {
    launchRenderedGames = games;
    launchRenderedGroups = launchGroups(games);
  }
  const library = $("#launchLibrary");
  const scroller = $(".launch-main");
  if (!library || !scroller) return;

  const gap = 10;
  const groupGap = 20;
  const headerHeight = 34;
  const cardHeight = state.launchBoxSize + 94;
  const width = library.clientWidth || scroller.clientWidth;
  if (!width) return;

  library.style.setProperty("--box-size", `${state.launchBoxSize}px`);

  if (!launchRenderedGames.length) {
    library.style.height = "100%";
    library.innerHTML = placeholderHtml(...launchPlaceholderCopy(), "placeholder-card launch-placeholder");
    return;
  }

  const columns = Math.max(1, Math.floor((width + gap) / (state.launchBoxSize + gap)));
  const cardWidth = (width - gap * (columns - 1)) / columns;
  const viewportTop = scroller.scrollTop - cardHeight * 2;
  const viewportBottom = scroller.scrollTop + scroller.clientHeight + cardHeight * 2;
  let top = 0;
  const rendered = [];

  launchRenderedGroups.forEach((group) => {
    const rows = Math.ceil(group.games.length / columns);
    const cardsHeight = rows * cardHeight + Math.max(0, rows - 1) * gap;
    const headingHeight = group.header ? headerHeight + gap : 0;
    const groupHeight = headingHeight + cardsHeight;
    const year = launchSystemYear(group.system);
    if (top + groupHeight >= viewportTop && top <= viewportBottom) {
      if (group.header) rendered.push(`<header class="launch-group-header" style="top:${top}px;height:${headerHeight}px"><h2>${launchSystemName(group.system)}</h2><span>${[year, `${group.games.length} ${group.games.length === 1 ? "game" : "games"}`].filter(Boolean).join(" · ")}</span></header>`);
      group.games.forEach((game, index) => {
        const row = Math.floor(index / columns);
        const cardTop = top + headingHeight + row * (cardHeight + gap);
        if (cardTop + cardHeight < viewportTop || cardTop > viewportBottom) return;
        const column = index % columns;
        const status = launchGameStatus(game, group.id);
        rendered.push(`
          <article class="cover ${game.id === state.launchGame ? "active" : ""}" data-launch-game="${game.id}" data-launch-game-system="${group.id}" data-controller role="button" tabindex="0" style="position:absolute;left:${column * (cardWidth + gap)}px;top:${cardTop}px;width:${cardWidth}px;height:${cardHeight}px">
            <div class="cover-art">${gameInitials(game.title)}</div>
            <div class="cover-caption"><span class="status" style="--status-color:var(--${statusColour(status)})">${status}</span><span class="cover-title">${game.title}</span><small>${gameCardMeta(game)}</small></div>
          </article>`);
      });
    }
    top += groupHeight + groupGap;
  });

  library.style.height = `${Math.max(0, top - groupGap)}px`;
  library.innerHTML = rendered.join("");
}

function resetLaunchScroll() {
  const scroller = $(".launch-main");
  if (scroller) scroller.scrollTop = 0;
  launchScrollLast = 0;
}

function requestLaunchCardsRender() {
  if (launchCardFrame) return;
  launchCardFrame = requestAnimationFrame(() => {
    launchCardFrame = null;
    renderLaunchCards();
  });
}

function stopLaunchCabinetScroll() {
  if (launchScrollFrame) cancelAnimationFrame(launchScrollFrame);
  launchScrollFrame = null;
  launchScrollLast = 0;
}

function stepLaunchCabinetScroll(timestamp) {
  launchScrollFrame = null;
  const scroller = $(".launch-main");
  if (!state.launchCabinetScroll || state.view !== "launch" || !scroller) {
    stopLaunchCabinetScroll();
    return;
  }

  const max = scroller.scrollHeight - scroller.clientHeight;
  if (max <= 0) {
    launchScrollLast = 0;
    return;
  }

  const delta = launchScrollLast ? timestamp - launchScrollLast : 0;
  scroller.scrollTop = scroller.scrollTop >= max - 1 ? 0 : Math.min(max, scroller.scrollTop + delta * .018);
  requestLaunchCardsRender();
  launchScrollLast = timestamp;
  launchScrollFrame = requestAnimationFrame(stepLaunchCabinetScroll);
}

function syncLaunchCabinetScroll() {
  if (state.launchCabinetScroll && state.view === "launch") {
    if (!launchScrollFrame) launchScrollFrame = requestAnimationFrame(stepLaunchCabinetScroll);
    return;
  }
  stopLaunchCabinetScroll();
}

function setLaunchCabinetScroll(enabled) {
  state.launchCabinetScroll = enabled;
  const button = $("#launchCabinetScroll");
  button?.classList.toggle("active", enabled);
  button?.setAttribute("aria-pressed", String(enabled));
  syncLaunchCabinetScroll();
}

function launchMiddleScrollMarker() {
  let marker = $("#launchMiddleScrollMarker");
  if (!marker) {
    marker = document.createElement("div");
    marker.id = "launchMiddleScrollMarker";
    marker.className = "middle-scroll-marker";
    marker.hidden = true;
    document.body.append(marker);
  }
  return marker;
}

function showLaunchMiddleScrollMarker(x, y) {
  const marker = launchMiddleScrollMarker();
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.hidden = false;
}

function stopLaunchMiddleScroll() {
  if (launchMiddleScrollFrame) cancelAnimationFrame(launchMiddleScrollFrame);
  launchMiddleScrollFrame = null;
  launchMiddleScroll = null;
  $(".launch-main")?.classList.remove("middle-scroll");
  const marker = $("#launchMiddleScrollMarker");
  if (marker) marker.hidden = true;
}

function stepLaunchMiddleScroll(timestamp) {
  launchMiddleScrollFrame = null;
  const scroller = $(".launch-main");
  if (!launchMiddleScroll || state.view !== "launch" || !scroller) {
    stopLaunchMiddleScroll();
    return;
  }

  const max = scroller.scrollHeight - scroller.clientHeight;
  if (max > 0) {
    const delta = launchMiddleScroll.last ? timestamp - launchMiddleScroll.last : 0;
    const distance = launchMiddleScroll.y - launchMiddleScroll.originY;
    const speed = Math.sign(distance) * Math.min(1.1, Math.max(0, Math.abs(distance) - 8) * .012);
    scroller.scrollTop = clamp(scroller.scrollTop + speed * delta, 0, max);
    requestLaunchCardsRender();
  }

  launchMiddleScroll.last = timestamp;
  launchMiddleScrollFrame = requestAnimationFrame(stepLaunchMiddleScroll);
}

function startLaunchMiddleScroll(event) {
  if (launchMiddleScroll?.mode === "toggle") {
    stopLaunchMiddleScroll();
    return;
  }
  setLaunchCabinetScroll(false);
  launchMiddleScroll = {
    mode: "hold",
    pointerId: event.pointerId,
    originY: event.clientY,
    y: event.clientY,
    started: performance.now(),
    moved: false,
    last: 0
  };
  $(".launch-main")?.classList.add("middle-scroll");
  showLaunchMiddleScrollMarker(event.clientX, event.clientY);
  launchMiddleScrollFrame = requestAnimationFrame(stepLaunchMiddleScroll);
}

function updateLaunchMiddleScroll(event) {
  if (!launchMiddleScroll) return;
  launchMiddleScroll.y = event.clientY;
  launchMiddleScroll.moved = launchMiddleScroll.moved || Math.abs(event.clientY - launchMiddleScroll.originY) > 5;
}

function finishLaunchMiddleScroll(event) {
  if (!launchMiddleScroll || launchMiddleScroll.pointerId !== event.pointerId) return;
  updateLaunchMiddleScroll(event);
  if (!launchMiddleScroll.moved && performance.now() - launchMiddleScroll.started < 260) {
    launchMiddleScroll.mode = "toggle";
    launchMiddleScroll.pointerId = null;
    return;
  }
  stopLaunchMiddleScroll();
}

async function launchSelectedPort() {
  const port = selectedLaunchPort(selectedLaunchGame());
  if (!port?.path) return;
  const button = $("#launchSelected");
  const label = button.innerHTML;
  launchStatus = "loading";
  button.disabled = true;
  button.classList.add("loading");
  button.setAttribute("aria-busy", "true");
  button.replaceChildren(platoPulseElement(true), document.createTextNode("Launching"));
  renderLoadingActivity();
  try {
    console.info(await tauriInvoke("launch_file", { vaultFilePath: port.path }));
  } catch (error) {
    console.error(error);
  } finally {
    launchStatus = "idle";
    button.classList.remove("loading");
    button.removeAttribute("aria-busy");
    button.innerHTML = label;
    button.disabled = !portReady(port);
    renderLoadingActivity();
  }
}

function renderLaunch() {
  renderLoadingActivity();
  const games = launchVisibleGames();
  const selectedGame = selectedLaunchGame(games);
  if (selectedGame && state.launchGame !== selectedGame.id) state.launchGame = selectedGame.id;
  const selectedPort = selectedLaunchPort(selectedGame);
  if (selectedPort && state.launchPort !== portKey(selectedPort)) state.launchPort = portKey(selectedPort);
  const ports = [...(selectedGame?.ports || [])].sort(compareLaunchPorts);
  const detailRows = [
    selectedPort ? ["System", portSystemName(selectedPort)] : null,
    selectedPort ? ["Catalogue sources", selectedPort.manifestSources?.length || 0] : null
  ].filter(Boolean);

  $("#launchPresentation").innerHTML = `
    <div class="select-control launch-system-control" id="launchSystemControl">
      <span>System:</span>
      <input id="launchSystemInput" class="select-input" role="combobox" aria-controls="launchSystemMenu" aria-expanded="false" placeholder="All systems" value="${(state.launchSystemQuery || launchSystemLabel(state.launchSystem)).replace(/"/g, "&quot;")}">
      <div class="select-menu" id="launchSystemMenu" role="listbox">${launchSystemMenuHtml()}</div>
    </div>
    <input class="search" id="launchSearch" type="search" placeholder="Search titles" value="${state.launchQuery.replace(/"/g, "&quot;")}" aria-label="Search titles">
    <button class="dark-btn icon-toggle ${state.launchPlayableOnly ? "active" : ""}" id="launchPlayableOnly" type="button" title="Playable only" aria-label="Playable only" aria-pressed="${state.launchPlayableOnly}">✓</button>
    <select id="launchOrder" aria-label="Catalogue order">
      <option value="oldest" ${state.launchOrder === "oldest" ? "selected" : ""}>Oldest first</option>
      <option value="newest" ${state.launchOrder === "newest" ? "selected" : ""}>Newest first</option>
      <option value="title" ${state.launchOrder === "title" ? "selected" : ""}>Title A-Z</option>
    </select>
    <select id="launchGroup" aria-label="Catalogue grouping">
      <option value="system" ${state.launchGroup === "system" ? "selected" : ""}>Group by system</option>
      <option value="none" ${state.launchGroup === "none" ? "selected" : ""}>No grouping</option>
    </select>
    <input id="launchBoxSize" type="range" min="96" max="240" value="${state.launchBoxSize}" aria-label="Box art size">
    <button class="dark-btn icon-toggle launch-cabinet-toggle ${state.launchCabinetScroll ? "active" : ""}" id="launchCabinetScroll" type="button" title="Display cabinet scroll" aria-label="Display cabinet scroll" aria-pressed="${state.launchCabinetScroll}">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l1.8 3.7 4.1.6-3 2.9.7 4.1L8 11.2 4.4 13.1l.7-4.1-3-2.9 4.1-.6z"/></svg>
    </button>`;
  renderLaunchCards(games);
  $("#launchGame").innerHTML = selectedGame ? `
    <div class="system-image">${gameInitials(selectedGame.title)}</div>
    <div class="selected-name"><span>${selectedGame.title}</span></div>
    <dl class="detail-grid">${detailRows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("")}</dl>` : placeholderHtml(...launchPlaceholderCopy(), "placeholder-card placeholder-card-small");
  $("#launchPorts").innerHTML = selectedGame ? ports.map((port) => `
    <button class="port-row ${portKey(port) === state.launchPort || portSystemId(port) === state.launchPort ? "active" : ""}" data-launch-port="${portKey(port)}" type="button">
      ${portShot(port)}
      <span><strong>${portSystemName(port)}</strong><small>${[portYear(port) ? `System released ${portYear(port)}` : null, portEmulator(port)].filter(Boolean).join(" · ")}</small></span>
      <span class="lamp ${statusColour(portStatus(port))}"></span>
    </button>`).join("") : placeholderHtml("No platforms", "Select a title to inspect platform releases.", "placeholder-card placeholder-card-small");
  if (selectedPort) {
    $("#launchPlan").replaceChildren(
      miniRow(selectedPort.romPresent ? "green" : "red", "Game file", selectedPort.romPresent ? "in vault" : "not in vault"),
      miniRow(selectedPort.emulatorAvailable ? "green" : "red", portEmulator(selectedPort), selectedPort.emulatorAvailable ? "available" : "unavailable")
    );
    const button = document.createElement("button");
    button.className = "accent-btn square-action";
    button.id = "launchSelected";
    button.type = "button";
    button.disabled = !portReady(selectedPort) || !selectedPort?.path;
    button.innerHTML = "<span>Launch</span><small>Selected Platform</small>";
    $("#launchPlan").append(button);
  } else {
    $("#launchPlan").replaceChildren(placeholderElement("No launch plan", "Select a platform release to build a launch plan.", "placeholder-card placeholder-card-small"));
  }
  if (state.view === "launch") showDrawer("launch", state.launchDrawerOpen && Boolean(selectedGame));
  syncLaunchCabinetScroll();
}

function renderScrollbar() {
  const domain = timelineDomain();
  const left = scale(state.yearMin, domain.min, domain.max, 0, 100);
  const right = scale(state.yearMax, domain.min, domain.max, 0, 100);
  $("#rangeStartLabel").textContent = formatYear(state.yearMin);
  $("#rangeEndLabel").textContent = formatYear(state.yearMax);
  $("#rangeSelection").style.left = `${left}%`;
  $("#rangeSelection").style.width = `${right - left}%`;
  $("#rangeStart").style.left = `calc(${left}% - 5px)`;
  $("#rangeEnd").style.left = `calc(${right}% - 5px)`;
}

function formatYear(value) {
  return Math.round(value);
}

function pointerYear(event) {
  const rect = $("#rangeTrack").getBoundingClientRect();
  const domain = timelineDomain();
  return scale(event.clientX - rect.left, 0, rect.width, domain.min, domain.max);
}

function setYearFromPointer(event, thumb) {
  const value = pointerYear(event);
  if (thumb === "start") state.yearMin = Math.min(value, state.yearMax - 0.5);
  if (thumb === "end") state.yearMax = Math.max(value, state.yearMin + 0.5);
  if (thumb === "window") {
    const domain = timelineDomain();
    const rect = $("#rangeTrack").getBoundingClientRect();
    const yearsPerPixel = (domain.max - domain.min) / rect.width;
    const delta = (event.clientX - state.dragStartX) * yearsPerPixel;
    const width = state.dragStartMax - state.dragStartMin;
    state.yearMin = clamp(state.dragStartMin + delta, domain.min, domain.max - width);
    state.yearMax = state.yearMin + width;
  }
  clampTimelineWindow();
  renderExplore();
}

function switchView(view) {
  const previousView = state.view;
  if (previousView === "explore" && view !== "explore") {
    hideNodeTooltip();
    state.selected = null;
    renderedDetailId = "";
  }
  if (previousView === "launch" && view !== "launch") {
    state.launchDrawerOpen = false;
    stopLaunchCabinetScroll();
    stopLaunchMiddleScroll();
  }
  state.view = view;
  $$(".view").forEach((node) => node.classList.toggle("active", node.id === `view-${view}`));
  $$(".nav-button").forEach((node) => node.classList.toggle("active", node.dataset.view === view));
  if (view !== "explore" && $("#exploreDrawer").hidden === false) showDrawer("explore", false);
  if (view !== "launch" && $("#launchDrawer").hidden === false) showDrawer("launch", false);
  if (view === "explore") {
    renderExplore();
    renderDetail();
  }
  if (view === "launch") renderLaunch();
  if (view === "verify") {
    if (state.verifyStage === "artifacts") {
      showVerifyStage("artifacts");
      if (foundationManifestStatus === "idle") loadFoundations();
    } else {
      showVerifyStage("vault");
    }
  }
}

function renderAll() {
  renderExplore();
  renderDetail();
  if (state.view === "launch") renderLaunch();
  if (state.view === "verify") renderVerify();
  renderLoadingActivity();
}

function screenPoint(event) {
  const rect = $("#exploreCanvas").getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function worldPoint(event) {
  const point = screenPoint(event);
  if (state.layout === "timeline") {
    return {
      x: point.x,
      y: (point.y - graph.panY) / graph.zoom
    };
  }
  if (state.layout === "network") {
    const unrotated = rotatePoint({ x: point.x - graph.panX, y: point.y - graph.panY }, -graph.rotation);
    return { x: unrotated.x / graph.zoom, y: unrotated.y / graph.zoom };
  }
  return {
    x: (point.x - graph.panX) / graph.zoom,
    y: (point.y - graph.panY) / graph.zoom
  };
}

function hitNodeAt(event) {
  const { x, y } = worldPoint(event);
  return [...graph.hitboxes].reverse().find((box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);
}

function nodeTooltipLines(node) {
  const key = nodeKey(node);
  const hierarchy = state.subject === "systems"
    ? pathTo(key).slice(0, -1).map((id) => nodes()[id]?.name).filter(Boolean).join(" / ")
    : "";
  const networkCount = activeLinks(graph.scene?.items || []).filter(([source, target]) => source === key || target === key).length;
  const countLabel = state.subject === "network" ? "Connections" : state.subject === "games" ? "Descendants" : "Titles";
  const count = state.subject === "network" ? networkCount : titleCount(node);
  return [
    hierarchy,
    node.type === "system" ? `Maker: ${makerName(node)}` : "",
    state.subject === "games" && node.maker ? `Maker: ${node.maker}` : "",
    node.row ? `Class: ${node.row}` : "",
    node.span ? `Range: ${node.span}` : `Released: ${formatYear(node.year)}`,
    `${countLabel}: ${number.format(count)}`,
    node.type === "system" ? `Units: ${formatUnits(node.unitsSold)}` : "",
    node.type === "system" ? `Default: ${defaultEmulator(node)}` : ""
  ].filter(Boolean);
}

function hideNodeTooltip() {
  const tooltip = $("#nodeTooltip");
  if (!tooltip) return;
  tooltip.hidden = true;
  tooltip.dataset.node = "";
}

function positionNodeTooltip(event) {
  const tooltip = $("#nodeTooltip");
  const canvas = $(".canvas");
  if (!tooltip || !canvas || tooltip.hidden) return;
  const point = screenPoint(event);
  const pad = 8;
  const leftMax = Math.max(pad, canvas.clientWidth - tooltip.offsetWidth - pad);
  const topMax = Math.max(pad, canvas.clientHeight - tooltip.offsetHeight - pad);
  tooltip.style.left = `${clamp(point.x + 14, pad, leftMax)}px`;
  tooltip.style.top = `${clamp(point.y + 14, pad, topMax)}px`;
}

function showNodeTooltip(node, event) {
  const tooltip = $("#nodeTooltip");
  if (!tooltip) return;
  const key = nodeKey(node);
  if (tooltip.dataset.node !== key) {
    const title = document.createElement("strong");
    title.textContent = node.name;
    tooltip.replaceChildren(title, ...nodeTooltipLines(node).map((line) => {
      const row = document.createElement("span");
      row.textContent = line;
      return row;
    }));
    tooltip.dataset.node = key;
  }
  tooltip.hidden = false;
  positionNodeTooltip(event);
}

function updateNodeTooltip(event) {
  const hit = hitNodeAt(event);
  const node = hit ? nodes()[hit.id] : null;
  if (!node) {
    hideNodeTooltip();
    return hit;
  }
  showNodeTooltip(node, event);
  return hit;
}

function redrawCanvas() {
  if (graph.scene) requestGraphFrame();
}

function stepBack() {
  hideNodeTooltip();
  if (state.selected) {
    state.selected = null;
  } else {
    const open = [...state.open];
    state.open = new Set(open.slice(0, -1));
  }
  renderExplore();
  renderDetail();
}

function panTimeline(event) {
  const plot = timelinePlot(graph.scene.width, graph.scene.height);
  const span = state.canvasDrag.max - state.canvasDrag.min;
  const deltaYears = -(event.clientX - state.dragStartX) * span / Math.max(1, plot.right - plot.left);
  const domain = timelineDomain();
  state.yearMin = clamp(state.canvasDrag.min + deltaYears, domain.min, domain.max - span);
  state.yearMax = state.yearMin + span;
  graph.panX = 0;
  graph.panY = state.canvasDrag.panY + event.clientY - state.dragStartY;
  renderExplore();
}

function zoomTimelineAround(point, factor, base = {
  min: state.yearMin,
  max: state.yearMax,
  zoom: graph.zoom
}) {
  const domain = timelineDomain();
  const plot = timelinePlot(graph.scene.width, graph.scene.height);
  const fraction = clamp((point.x - plot.left) / Math.max(1, plot.right - plot.left), 0, 1);
  const baseSpan = base.max - base.min;
  const span = clamp(baseSpan / factor, .5, domain.max - domain.min);
  const focusYear = base.min + baseSpan * fraction;
  state.yearMin = clamp(focusYear - span * fraction, domain.min, domain.max - span);
  state.yearMax = state.yearMin + span;
  graph.zoom = 1;
  graph.panX = 0;
  renderExplore();
}

function handleTimelineWheel(event) {
  const point = screenPoint(event);
  if (event.shiftKey) {
    const span = state.yearMax - state.yearMin;
    const plot = timelinePlot(graph.scene.width, graph.scene.height);
    const deltaYears = (event.deltaX || event.deltaY) * .25 * span / Math.max(1, plot.right - plot.left);
    const domain = timelineDomain();
    state.yearMin = clamp(state.yearMin + deltaYears, domain.min, domain.max - span);
    state.yearMax = state.yearMin + span;
    graph.panX = 0;
    renderExplore();
    return;
  }
  zoomTimelineAround(point, Math.exp(-event.deltaY * .00035));
}

function pointerFromEvent(event) {
  const rect = $("#exploreCanvas").getBoundingClientRect();
  return { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function gestureMetrics() {
  const [a, b] = [...graph.pointers.values()];
  const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return {
    center,
    distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
    angle: Math.atan2(b.y - a.y, b.x - a.x)
  };
}

function startGesture() {
  const metrics = gestureMetrics();
  const rect = $("#exploreCanvas").getBoundingClientRect();
  graph.gesture = {
    ...metrics,
    panX: graph.panX,
    panY: graph.panY,
    zoom: graph.zoom,
    rotation: graph.rotation,
    yearMin: state.yearMin,
    yearMax: state.yearMax,
    worldCenter: state.layout !== "tree" ? worldPoint({ clientX: metrics.center.x + rect.left, clientY: metrics.center.y + rect.top }) : null
  };
  if (state.canvasDrag) state.canvasDrag.moved = true;
}

function updateGesture() {
  if (!graph.gesture || graph.pointers.size < 2) return false;
  const metrics = gestureMetrics();
  const scaleValue = metrics.distance / graph.gesture.distance;

  if (state.layout === "timeline") {
    zoomTimelineAround(metrics.center, scaleValue, {
      min: graph.gesture.yearMin,
      max: graph.gesture.yearMax,
      zoom: graph.gesture.zoom
    });
    return true;
  }

  if (state.layout === "tree") {
    graph.panY = clampTreePan(graph.gesture.panY + metrics.center.y - graph.gesture.center.y);
    redrawCanvas();
    return true;
  }

  setGraphTransformAround(
    metrics.center,
    graph.gesture.worldCenter,
    clamp(graph.gesture.zoom * scaleValue, 0.45, 3),
    graph.gesture.rotation + metrics.angle - graph.gesture.angle
  );
  redrawCanvas();
  return true;
}

function bindEvents() {
  $("#startupRetry").addEventListener("click", loadStartupData);
  $("#foundationRecheck").addEventListener("click", loadFoundations);
  $("#foundationContinue").addEventListener("click", () => showVerifyStage("vault"));
  $("#verifyArtifactsStep").addEventListener("click", () => showVerifyStage("artifacts"));
  $("#verifyVaultStep").addEventListener("click", () => showVerifyStage("vault"));
  $("#verifySystemSearch").addEventListener("input", (event) => {
    state.verifyQuery = event.target.value;
    verifyTreeDirty = true;
    renderVerifySystems();
  });
  $$('[data-manifest-filter]').forEach((button) => button.addEventListener("click", () => {
    state.verifyManifestFilter = button.dataset.manifestFilter;
    verifyTreeDirty = true;
    renderVerify();
  }));
  $$('[data-release-filter]').forEach((button) => button.addEventListener("click", () => {
    state.verifyReleaseFilter = button.dataset.releaseFilter;
    renderVerifyReleases();
  }));
  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    hideNodeTooltip();
    if (state.view === "launch") closeActiveDrawer();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (launchMiddleScroll) {
      event.preventDefault();
      stopLaunchMiddleScroll();
      return;
    }
    if (!$("#controllerModal").hidden) {
      event.preventDefault();
      $("#closeControllerGuide").click();
      return;
    }
    if (!$("#settingsModal").hidden) {
      event.preventDefault();
      closeSettings();
      return;
    }
    if (!$("#emulatorsModal").hidden) {
      event.preventDefault();
      closeEmulators();
      return;
    }
    if (!$("#aboutModal").hidden) {
      event.preventDefault();
      closeAbout();
      return;
    }
    if (state.view === "explore") {
      event.preventDefault();
      stepBack();
    }
  });
  $$(".nav-button").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.view === "launch") state.launchDrawerOpen = false;
    switchView(button.dataset.view);
  }));
  $$(".titlebar").forEach((bar) => bar.addEventListener("mousedown", (event) => {
    if (event.button === 0 && !event.target.closest("button, .select-control, .lamp-menu-control")) shellInvoke("start_drag");
  }));
  $("#openSettings").addEventListener("click", openSettings);
  $("#openAbout").addEventListener("click", openAbout);
  $("#closeAbout").addEventListener("click", closeAbout);
  $("#aboutModal").addEventListener("click", (event) => {
    if (event.target.id === "aboutModal") closeAbout();
  });
  $("#openEmulators").addEventListener("click", openEmulators);
  $("#closeEmulators").addEventListener("click", closeEmulators);
  $("#emulatorsModal").addEventListener("click", (event) => {
    if (event.target.id === "emulatorsModal") closeEmulators();
  });
  $("#emulatorSearch").addEventListener("input", renderEmulatorProfiles);
  $("#closeSettings").addEventListener("click", closeSettings);
  $("#settingsModal").addEventListener("click", (event) => {
    if (event.target.id === "settingsModal") closeSettings();
  });
  $("#settingsModal").addEventListener("input", (event) => {
    if (!event.target.dataset.customColour) return;
    setCustomColour(event.target.dataset.customTheme, event.target.dataset.customColour, event.target.value);
  });
  $("#settingAppTheme").addEventListener("change", (event) => setAppSetting("appTheme", event.target.value));
  $("#settingLightColourScheme").addEventListener("change", (event) => setAppColourScheme("light", event.target.value));
  $("#settingDarkColourScheme").addEventListener("change", (event) => setAppColourScheme("dark", event.target.value));
  $("#settingLightMinimumContrast").addEventListener("change", (event) => setMinimumContrast("light", event.target.checked));
  $("#settingDarkMinimumContrast").addEventListener("change", (event) => setMinimumContrast("dark", event.target.checked));
  $("#settingLaunchOnStartup").addEventListener("change", (event) => setLaunchOnStartup(event.target.checked));
  $("#settingMinimizeToTray").addEventListener("change", (event) => setAppSetting("minimizeToTray", event.target.checked));
  $("#settingCloseToTray").addEventListener("change", (event) => setAppSetting("closeToTray", event.target.checked));
  $("#minimizeWindow").addEventListener("click", () => shellInvoke(state.appSettings.minimizeToTray ? "minimize_to_tray" : "minimize_window"));
  $("#maximizeWindow").addEventListener("click", () => shellInvoke("toggle_maximize"));
  $("#closeWindow").addEventListener("click", () => shellInvoke(state.appSettings.closeToTray ? "close_to_tray" : "quit_app"));
  $("#closeDrawer").addEventListener("click", closeActiveDrawer);
  $("#exploreOrderButton").addEventListener("click", () => {
    const control = $("#exploreOrderControl");
    const open = !control.classList.contains("open");
    control.classList.toggle("open", open);
    $("#exploreOrderButton").setAttribute("aria-expanded", String(open));
  });
  $$("[data-order]").forEach((button) => button.addEventListener("click", () => setOrder(button.dataset.order)));
  document.addEventListener("click", (event) => {
    if (event.target.closest("#exploreOrderControl, #launchSystemControl")) return;
    $("#exploreOrderControl").classList.remove("open");
    $("#exploreOrderButton").setAttribute("aria-expanded", "false");
    $("#launchSystemControl")?.classList.remove("open");
    $("#launchSystemInput")?.setAttribute("aria-expanded", "false");
  });
  $$("[data-mode]").forEach((button) => button.addEventListener("click", () => setExploreMode(button.dataset.mode)));
  $("#toggleLamps").addEventListener("click", () => {
    state.showLamps = !state.showLamps;
    syncLampControls();
    redrawCanvas();
  });
  $("#timelineDensity").addEventListener("input", (event) => {
    state.timelineDensity = clamp(Number(event.target.value) / 100, 0, 1);
    renderExplore();
  });
  $("#exploreCanvas").addEventListener("contextmenu", (event) => {
    event.preventDefault();
    stepBack();
  });
  $("#exploreCanvas").addEventListener("auxclick", (event) => {
    if (event.button !== 1) return;
    event.preventDefault();
    if (state.layout === "timeline") resetAndFitTimeline();
  });
  $("#exploreCanvas").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (event.button !== 0) return;
    hideNodeTooltip();
    const point = screenPoint(event);
    graph.pointers.set(event.pointerId, pointerFromEvent(event));
    event.currentTarget.setPointerCapture(event.pointerId);
    if (graph.pointers.size >= 2) {
      startGesture();
      return;
    }
    state.canvasDrag = {
      id: event.pointerId,
      startX: point.x,
      startY: point.y,
      panX: graph.panX,
      panY: graph.panY,
      min: state.yearMin,
      max: state.yearMax,
      moved: false
    };
    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;
    state.dragStartMin = state.yearMin;
    state.dragStartMax = state.yearMax;
  });
  $("#exploreCanvas").addEventListener("pointermove", (event) => {
    if (graph.pointers.has(event.pointerId)) graph.pointers.set(event.pointerId, pointerFromEvent(event));
    if (updateGesture()) {
      hideNodeTooltip();
      event.currentTarget.style.cursor = "grabbing";
      return;
    }
    if (state.canvasDrag?.id === event.pointerId) {
      const point = screenPoint(event);
      const dx = point.x - state.canvasDrag.startX;
      const dy = point.y - state.canvasDrag.startY;
      state.canvasDrag.moved = state.canvasDrag.moved || Math.hypot(dx, dy) > 3;
      if (!state.canvasDrag.moved) return;
      hideNodeTooltip();
      if (state.layout === "timeline") {
        panTimeline(event);
      } else if (state.layout === "tree") {
        graph.panY = clampTreePan(state.canvasDrag.panY + dy);
        redrawCanvas();
      } else {
        graph.panX = state.canvasDrag.panX + dx;
        graph.panY = state.canvasDrag.panY + dy;
        redrawCanvas();
      }
      event.currentTarget.style.cursor = "grabbing";
      return;
    }
    event.currentTarget.style.cursor = updateNodeTooltip(event) ? "pointer" : "grab";
  });
  $("#exploreCanvas").addEventListener("pointerup", (event) => {
    hideNodeTooltip();
    graph.pointers.delete(event.pointerId);
    if (graph.pointers.size < 2) graph.gesture = null;
    if (state.canvasDrag?.id !== event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    const drag = state.canvasDrag;
    state.canvasDrag = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.style.cursor = "grab";
    if (!drag.moved) {
      const hit = hitNodeAt(event);
      if (hit) toggleNode(hit.id);
    }
  });
  $("#exploreCanvas").addEventListener("pointercancel", () => {
    hideNodeTooltip();
    graph.pointers.clear();
    graph.gesture = null;
    state.canvasDrag = null;
  });
  $("#exploreCanvas").addEventListener("wheel", (event) => {
    event.preventDefault();
    hideNodeTooltip();
    if (state.layout === "timeline") {
      handleTimelineWheel(event);
      return;
    }
    if (state.layout === "tree") {
      graph.panY = clampTreePan(graph.panY - event.deltaY - event.deltaX);
      redrawCanvas();
      return;
    }
    const point = screenPoint(event);
    if (event.ctrlKey) {
      const before = worldPoint(event);
      setGraphTransformAround(point, before, clamp(graph.zoom * Math.exp(-event.deltaY * 0.001), 0.45, 3));
    } else {
      graph.panX -= event.deltaX;
      graph.panY -= event.deltaY;
    }
    redrawCanvas();
  });
  $("#exploreCanvas").addEventListener("pointerleave", () => {
    hideNodeTooltip();
  });
  $("#launchTitles").addEventListener("click", () => {
    const node = currentNode();
    if (!node) return;
    if (state.subject === "systems" && node.type === "system") {
      state.launchSystem = nodeKey(node);
      state.launchQuery = "";
      state.launchSystemQuery = "";
      state.launchDrawerOpen = true;
    }
    if (state.subject === "games" && node.type === "game") {
      const game = launchGameForExploreNode(node);
      state.launchSystem = null;
      if (game) {
        state.launchGame = game.id;
        state.launchPort = portKey(selectedLaunchPort(game)) || null;
        state.launchDrawerOpen = true;
      }
    }
    switchView("launch");
  });
  $("#verifyTitles").addEventListener("click", () => {
    const node = currentNode();
    if (!node || state.subject !== "systems" || node.type !== "system") return;
    state.verifyNode = nodeKey(node);
    switchView("verify");
    const selectedNode = verifyNode();
    if (selectedNode) selectVerifyNode(selectedNode);
  });
  $("#launchPresentation").addEventListener("input", (event) => {
    if (event.target.id === "launchBoxSize") {
      state.launchBoxSize = Number(event.target.value);
      renderLaunchCards();
      syncLaunchCabinetScroll();
      return;
    }
    if (event.target.id === "launchSystemInput") {
      state.launchSystemQuery = event.target.value;
      $("#launchSystemControl").classList.add("open");
      $("#launchSystemInput").setAttribute("aria-expanded", "true");
      $("#launchSystemMenu").innerHTML = launchSystemMenuHtml();
      return;
    }
    if (event.target.id !== "launchSearch") return;
    const caret = event.target.selectionStart;
    state.launchQuery = event.target.value;
    resetLaunchScroll();
    renderLaunch();
    $("#launchSearch")?.focus();
    $("#launchSearch")?.setSelectionRange(caret, caret);
  });
  $("#launchPresentation").addEventListener("change", (event) => {
    if (event.target.id === "launchBoxSize") {
      state.launchBoxSize = Number(event.target.value);
      return;
    }
    if (event.target.id === "launchOrder") state.launchOrder = event.target.value;
    else if (event.target.id === "launchGroup") state.launchGroup = event.target.value;
    else return;
    resetLaunchScroll();
    renderLaunch();
  });
  $("#launchPresentation").addEventListener("keydown", (event) => {
    if (event.target.id !== "launchSystemInput") return;
    if (event.key === "Escape") {
      $("#launchSystemControl").classList.remove("open");
      $("#launchSystemInput").setAttribute("aria-expanded", "false");
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    $("#launchSystemMenu [data-launch-system]")?.click();
  });
  $("#launchPresentation").addEventListener("click", (event) => {
    if (event.target.id === "launchSystemInput") {
      const control = $("#launchSystemControl");
      control.classList.add("open");
      $("#launchSystemInput").setAttribute("aria-expanded", "true");
      return;
    }
    const systemButton = event.target.closest("[data-launch-system]");
    if (systemButton) {
      state.launchSystem = systemButton.dataset.launchSystem || null;
      state.launchSystemQuery = "";
      state.launchPort = state.launchSystem || portKey(selectedLaunchPort(selectedLaunchGame())) || null;
      resetLaunchScroll();
      $("#launchSystemControl").classList.remove("open");
      renderLaunch();
      return;
    }
    if (event.target.id === "launchPlayableOnly") {
      state.launchPlayableOnly = !state.launchPlayableOnly;
      resetLaunchScroll();
      renderLaunch();
      return;
    }
    if (event.target.closest("#launchCabinetScroll")) {
      setLaunchCabinetScroll(!state.launchCabinetScroll);
    }
  });
  $(".launch-main").addEventListener("pointerdown", (event) => {
    if (event.button !== 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    startLaunchMiddleScroll(event);
  });
  $(".launch-main").addEventListener("pointerup", (event) => {
    if (event.button !== 1) return;
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    finishLaunchMiddleScroll(event);
  });
  $(".launch-main").addEventListener("pointercancel", stopLaunchMiddleScroll);
  $(".launch-main").addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });
  window.addEventListener("pointermove", updateLaunchMiddleScroll);
  window.addEventListener("blur", stopLaunchMiddleScroll);
  $(".launch-main").addEventListener("scroll", () => {
    if (state.view === "launch") requestLaunchCardsRender();
  });
  $("#launchLibrary").addEventListener("click", (event) => {
    if (launchMiddleScroll?.mode === "toggle") {
      stopLaunchMiddleScroll();
      return;
    }
    const card = event.target.closest("[data-launch-game]");
    if (!card) return;
    state.launchGame = card.dataset.launchGame;
    const game = selectedLaunchGame();
    const groupedPort = game?.ports.find((port) => portSystemId(port) === card.dataset.launchGameSystem);
    state.launchPort = groupedPort ? portKey(groupedPort) : portKey(selectedLaunchPort(game)) || null;
    state.launchDrawerOpen = true;
    renderLaunch();
  });
  $("#launchPorts").addEventListener("click", (event) => {
    const row = event.target.closest("[data-launch-port]");
    if (!row) return;
    state.launchPort = row.dataset.launchPort;
    renderLaunch();
  });
  $("#launchPlan").addEventListener("click", (event) => {
    if (event.target.closest("#launchSelected")) launchSelectedPort();
  });
  $("#rangeStart").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.dragThumb = "start";
  });
  $("#rangeEnd").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.dragThumb = "end";
  });
  $("#rangeSelection").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.dragThumb = "window";
    state.dragStartX = event.clientX;
    state.dragStartMin = state.yearMin;
    state.dragStartMax = state.yearMax;
  });
  window.addEventListener("pointermove", (event) => {
    if (state.dragThumb) setYearFromPointer(event, state.dragThumb);
  });
  window.addEventListener("pointerup", () => state.dragThumb = null);
  window.addEventListener("resize", renderAll);
  systemTheme?.addEventListener?.("change", () => {
    if (state.appSettings.appTheme === "system") applyAppTheme();
  });
  renderSettings();
  syncWindowSettings();
  syncLaunchOnStartup();
}

applyAppTheme();
bindEvents();
renderAll();
loadStartupData().then(() => {
  if (demoView === "emulators") openEmulators();
});
