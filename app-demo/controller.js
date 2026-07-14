"use strict";

const controllerSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[data-controller]"
].join(",");
const controller = {
  frame: null,
  buttons: [],
  guidePressed: false,
  direction: null,
  nextRepeat: 0,
  pane: "stage",
  region: "body",
  returnPane: "stage",
  returnRegion: "body",
  remembered: new Map(),
  guideReturn: null
};

function controllerVisible(element) {
  if (!element || element.disabled || element.closest("[hidden], [inert], .window-controls")) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function controllerExclusiveScope() {
  const modal = $$(".modal-backdrop").find((element) => !element.hidden);
  if (modal) return modal;
  const foundation = $("#foundationGate");
  if (foundation && !foundation.hidden) return foundation;
  const startup = $("#startupSplash");
  return startup && !startup.hidden ? startup : null;
}

function controllerPaneFor(element) {
  if (!element) return controller.pane;
  if (element.closest(".modal-backdrop, .foundation-gate, .startup-splash")) return "modal";
  if (element.closest(".titlemenu")) return "menu";
  if (element.closest(".rail")) return "rail";
  if (element.closest("#detailSide")) return "side";
  if (element.closest(".stage")) return "stage";
  return controller.pane;
}

function controllerRegionFor(element, pane = controllerPaneFor(element)) {
  if (pane === "menu") return "top";
  if (pane === "rail") return "body";
  if (pane === "side") return element?.closest(".drawer-close") ? "top" : "body";
  if (pane === "modal") {
    return element?.closest(".dialog-header, .emulator-toolbar, .foundation-header") ? "top" : "body";
  }
  return element?.closest(".stage-title, .verify-toolbar, .verify-release-header, .presentation-bar")
    ? "top"
    : "body";
}

function controllerPaneRoot(pane) {
  const exclusive = controllerExclusiveScope();
  if (exclusive) return pane === "modal" ? exclusive : null;
  if (pane === "menu") return $(".titlemenu");
  if (pane === "rail") return $(".rail");
  if (pane === "stage") return $(".stage");
  if (pane === "side" && !$("#detailSide")?.classList.contains("empty")) return $("#detailSide");
  return null;
}

function controllerTargets(pane = controller.pane, region = null) {
  const root = controllerPaneRoot(pane);
  if (!root) return [];
  return [...root.querySelectorAll(controllerSelector)]
    .filter(controllerVisible)
    .filter((element) => !region || controllerRegionFor(element, pane) === region);
}

function controllerPreferredTarget(targets) {
  return targets.find((element) => element.classList.contains("active"))
    || targets.find((element) => element.getAttribute("aria-checked") === "true")
    || targets.find((element) => element.getAttribute("aria-pressed") === "true")
    || targets[0];
}

function controllerFocus(element) {
  if (!controllerVisible(element)) return false;
  document.body.classList.add("controller-input");
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: "nearest", inline: "nearest" });
  controller.pane = controllerPaneFor(element);
  controller.region = controllerRegionFor(element, controller.pane);
  controller.remembered.set(`${controller.pane}:${controller.region}`, element);
  return true;
}

function controllerFocusPane(pane, region = null) {
  const wantedRegion = region || (pane === "stage" ? controller.region : pane === "menu" ? "top" : "body");
  const targets = controllerTargets(pane, wantedRegion);
  const remembered = controller.remembered.get(`${pane}:${wantedRegion}`);
  const target = remembered && targets.includes(remembered)
    ? remembered
    : pane === "menu" ? targets[0]
      : controllerPreferredTarget(targets) || controllerPreferredTarget(controllerTargets(pane));
  return target ? controllerFocus(target) : false;
}

function controllerAvailablePanes() {
  return ["rail", "stage", "side"].filter((pane) => controllerTargets(pane).length);
}

function controllerShiftPane(delta) {
  if (controllerExclusiveScope()) return;
  const panes = controllerAvailablePanes();
  if (!panes.length) return;
  const current = controller.pane === "menu" ? controller.returnPane : controller.pane;
  const index = Math.max(0, panes.indexOf(current));
  controllerFocusPane(panes[(index + delta + panes.length) % panes.length]);
}

function controllerToggleRegion() {
  const pane = controllerPaneFor(document.activeElement);
  if (["menu", "rail"].includes(pane)) return;
  const region = controllerRegionFor(document.activeElement, pane) === "top" ? "body" : "top";
  if (controllerTargets(pane, region).length) controllerFocusPane(pane, region);
}

function controllerToggleMenu() {
  if (controllerExclusiveScope()) return;
  if (controller.pane === "menu") {
    controllerFocusPane(controller.returnPane, controller.returnRegion);
    return;
  }
  controller.returnPane = controller.pane;
  controller.returnRegion = controller.region;
  controllerFocusPane("menu", "top");
}

function controllerCenter(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function controllerSpatialTarget(current, targets, dx, dy) {
  const origin = controllerCenter(current);
  return targets
    .filter((candidate) => candidate !== current)
    .map((candidate) => {
      const center = controllerCenter(candidate);
      const offsetX = center.x - origin.x;
      const offsetY = center.y - origin.y;
      const forward = offsetX * dx + offsetY * dy;
      const cross = Math.abs(offsetX * dy - offsetY * dx);
      return { candidate, forward, score: forward + cross * 1.8 };
    })
    .filter(({ forward }) => forward > 3)
    .sort((a, b) => a.score - b.score)[0]?.candidate;
}

function controllerAdjustRange(element, dx, dy) {
  const direction = dx || -dy;
  if (!direction) return false;
  if (element.matches('input[type="range"]')) {
    direction > 0 ? element.stepUp() : element.stepDown();
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  if (!["rangeStart", "rangeEnd"].includes(element.id)) return false;
  const domain = timelineDomain();
  if (element.id === "rangeStart") {
    state.yearMin = clamp(state.yearMin + Math.sign(direction), domain.min, state.yearMax - 1);
  } else {
    state.yearMax = clamp(state.yearMax + Math.sign(direction), state.yearMin + 1, domain.max);
  }
  renderExplore();
  return true;
}

function controllerGraphPosition(id) {
  return graph.positions.get(id) || graph.scene?.targets.get(id);
}

function controllerMoveGraph(dx, dy) {
  const items = graph.scene?.items || [];
  if (!items.length) return;
  const candidates = items
    .map((node) => ({ id: nodeKey(node), position: controllerGraphPosition(nodeKey(node)) }))
    .filter(({ position }) => position);
  const current = candidates.find(({ id }) => id === state.selected);
  if (!current) {
    const center = { x: graph.scene.width / 2, y: graph.scene.height / 2 };
    const nearest = candidates.sort((a, b) =>
      Math.hypot(a.position.x - center.x, a.position.y - center.y)
      - Math.hypot(b.position.x - center.x, b.position.y - center.y))[0];
    if (nearest) selectNode(nearest.id);
    $("#exploreCanvas").focus();
    return;
  }
  const next = candidates
    .filter(({ id }) => id !== current.id)
    .map((candidate) => {
      const offsetX = candidate.position.x - current.position.x;
      const offsetY = candidate.position.y - current.position.y;
      const forward = offsetX * dx + offsetY * dy;
      const cross = Math.abs(offsetX * dy - offsetY * dx);
      return { ...candidate, forward, score: forward + cross * 1.8 };
    })
    .filter(({ forward }) => forward > 2)
    .sort((a, b) => a.score - b.score)[0];
  if (next) selectNode(next.id);
  $("#exploreCanvas").focus();
}

function controllerMove(dx, dy) {
  document.body.classList.add("controller-input");
  const current = controllerVisible(document.activeElement) ? document.activeElement : null;
  if (!current) {
    const scope = controllerExclusiveScope();
    controllerFocusPane(scope ? "modal" : controller.pane, controller.region);
    return;
  }
  if (current.id === "exploreCanvas") {
    controllerMoveGraph(dx, dy);
    return;
  }
  if (document.body.classList.contains("themes-demo") && current.matches("select") && dx) {
    const options = [...current.options].filter((option) => option.value !== "custom");
    const index = Math.max(0, options.indexOf(current.selectedOptions[0]));
    current.value = options[(index + Math.sign(dx) + options.length) % options.length].value;
    window.__ARCHIVIST_THEME_DEMO_GAMEPAD_CHANGE = true;
    current.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  if (controllerAdjustRange(current, dx, dy)) return;
  const pane = controllerPaneFor(current);
  const region = controllerRegionFor(current, pane);
  const target = controllerSpatialTarget(current, controllerTargets(pane, region), dx, dy);
  if (target) controllerFocus(target);
}

function controllerConfirm() {
  document.body.classList.add("controller-input");
  const current = controllerVisible(document.activeElement) ? document.activeElement : null;
  if (!current) {
    controllerFocusPane(controllerExclusiveScope() ? "modal" : controller.pane, controller.region);
    return;
  }
  if (current.id === "exploreCanvas") {
    if (state.selected && visibleIds().includes(state.selected)) toggleNode(state.selected);
    else controllerMoveGraph(0, 0);
    current.focus();
    return;
  }
  if (document.body.classList.contains("themes-demo")) {
    window.__ARCHIVIST_THEME_DEMO_GAMEPAD_CHANGE = true;
  }
  current.click();
}

function controllerCloseSelectMenus() {
  const open = $$(".select-control.open");
  open.forEach((control) => {
    control.classList.remove("open");
    control.querySelector('[aria-expanded="true"]')?.setAttribute("aria-expanded", "false");
  });
  return Boolean(open.length);
}

function controllerBack() {
  document.body.classList.add("controller-input");
  const exclusive = controllerExclusiveScope();
  if (exclusive?.classList.contains("modal-backdrop")) {
    exclusive.querySelector(".dialog-close")?.click();
    return;
  }
  if (exclusive) return;
  if (controllerCloseSelectMenus()) return;
  if (!$("#detailSide")?.classList.contains("empty")) {
    closeActiveDrawer();
    controllerFocusPane("stage", "body");
    return;
  }
  if (state.view === "verify" && state.intakePath) {
    loadIntake(state.intakePath.split("/").slice(0, -1).join("/"));
    return;
  }
  if (state.view === "explore") {
    stepBack();
    return;
  }
  if (controller.pane === "menu") controllerToggleMenu();
}

function controllerScrollable(element) {
  const style = getComputedStyle(element);
  return /(auto|scroll)/.test(`${style.overflow}${style.overflowX}${style.overflowY}`)
    && (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth);
}

function controllerScrollTarget() {
  const pane = controllerPaneFor(document.activeElement);
  const root = controllerPaneRoot(pane);
  if (!root) return null;
  let element = document.activeElement;
  while (element && element !== root) {
    if (controllerScrollable(element)) return element;
    element = element.parentElement;
  }
  const candidates = [...root.querySelectorAll([
    ".launch-main",
    ".verify-system-list",
    ".verify-release-list",
    ".organizer-file-list",
    ".scroll",
    ".emulator-table-wrap",
    ".settings-list",
    ".custom-colour-tray",
    ".foundation-list"
  ].join(","))].filter(controllerScrollable);
  if (!candidates.length) return null;
  const origin = controllerCenter(document.activeElement);
  return candidates.sort((a, b) => {
    const aCenter = controllerCenter(a);
    const bCenter = controllerCenter(b);
    return Math.hypot(aCenter.x - origin.x, aCenter.y - origin.y)
      - Math.hypot(bCenter.x - origin.x, bCenter.y - origin.y);
  })[0];
}

function controllerAxis(value, deadzone = .18) {
  const magnitude = Math.abs(value);
  return magnitude <= deadzone ? 0 : Math.sign(value) * (magnitude - deadzone) / (1 - deadzone);
}

function controllerRightStick(x, y) {
  x = controllerAxis(x);
  y = controllerAxis(y);
  if (!x && !y) return;
  document.body.classList.add("controller-input");
  if (document.activeElement?.id === "exploreCanvas" && state.view === "explore") {
    if (state.layout === "timeline") panTimelineByPixels(x * 18);
    else {
      graph.panX -= x * 14;
      graph.panY -= y * 14;
      if (state.layout === "tree") graph.panY = clampTreePan(graph.panY);
      redrawCanvas();
    }
    return;
  }
  controllerScrollTarget()?.scrollBy({ left: x * 14, top: y * 14 });
}

function openControllerGuide() {
  const modal = $("#controllerModal");
  if (!modal.hidden) {
    closeControllerGuide();
    return;
  }
  controller.guideReturn = controllerVisible(document.activeElement) ? document.activeElement : null;
  modal.hidden = false;
  $("#openControllerGuide")?.setAttribute("aria-expanded", "true");
  controllerFocus($("#closeControllerGuide"));
}

function closeControllerGuide() {
  $("#controllerModal").hidden = true;
  $("#openControllerGuide")?.setAttribute("aria-expanded", "false");
  const target = controller.guideReturn;
  controller.guideReturn = null;
  if (!controllerFocus(target)) controllerFocusPane(controller.returnPane, controller.returnRegion);
}

function controllerDirection(gamepad) {
  const horizontal = (gamepad.buttons[15]?.pressed ? 1 : 0)
    - (gamepad.buttons[14]?.pressed ? 1 : 0);
  const vertical = (gamepad.buttons[13]?.pressed ? 1 : 0)
    - (gamepad.buttons[12]?.pressed ? 1 : 0);
  const axisX = Math.abs(gamepad.axes[0] || 0) > .55 ? Math.sign(gamepad.axes[0]) : 0;
  const axisY = Math.abs(gamepad.axes[1] || 0) > .55 ? Math.sign(gamepad.axes[1]) : 0;
  const x = horizontal || axisX;
  const y = vertical || axisY;
  if (!x && !y) return null;
  return Math.abs(gamepad.axes[0] || x) >= Math.abs(gamepad.axes[1] || y)
    ? { name: x > 0 ? "right" : "left", x, y: 0 }
    : { name: y > 0 ? "down" : "up", x: 0, y };
}

function controllerButtonEdge(gamepad, index) {
  return Boolean(gamepad.buttons[index]?.pressed) && !controller.buttons[index];
}

function controllerPoll(time) {
  const gamepad = [...(navigator.getGamepads?.() || [])].find(Boolean);
  if (!gamepad) {
    controller.frame = null;
    controller.buttons = [];
    controller.direction = null;
    return;
  }

  const direction = controllerDirection(gamepad);
  if (direction?.name !== controller.direction) {
    controller.direction = direction?.name || null;
    controller.nextRepeat = time + 340;
    if (direction) controllerMove(direction.x, direction.y);
  } else if (direction && time >= controller.nextRepeat) {
    controller.nextRepeat = time + 105;
    controllerMove(direction.x, direction.y);
  }

  const restrictedSettingsDemo = document.body.classList.contains("themes-demo");
  const guidePressed = Boolean(gamepad.buttons[16]?.pressed || gamepad.buttons[17]?.pressed);
  if (!restrictedSettingsDemo && guidePressed && !controller.guidePressed) openControllerGuide();
  if (controllerButtonEdge(gamepad, 0)) controllerConfirm();
  if (!restrictedSettingsDemo) {
    if (controllerButtonEdge(gamepad, 1)) controllerBack();
    if (controllerButtonEdge(gamepad, 4)) controllerShiftPane(-1);
    if (controllerButtonEdge(gamepad, 5)) controllerShiftPane(1);
    if (controllerButtonEdge(gamepad, 8)) controllerToggleRegion();
    if (controllerButtonEdge(gamepad, 9)) controllerToggleMenu();
    controllerRightStick(gamepad.axes[2] || 0, gamepad.axes[3] || 0);
  }

  controller.guidePressed = guidePressed;
  controller.buttons = gamepad.buttons.map((button) => button.pressed);
  controller.frame = requestAnimationFrame(controllerPoll);
}

function startControllerPolling() {
  if (!controller.frame) controller.frame = requestAnimationFrame(controllerPoll);
}

$("#closeControllerGuide").addEventListener("click", closeControllerGuide);
$("#openControllerGuide")?.addEventListener("click", openControllerGuide);
$("#controllerModal").addEventListener("click", (event) => {
  if (event.target.id === "controllerModal") closeControllerGuide();
});
document.addEventListener("focusin", (event) => {
  if (!event.target.matches?.(controllerSelector) || !controllerVisible(event.target)) return;
  controller.pane = controllerPaneFor(event.target);
  controller.region = controllerRegionFor(event.target, controller.pane);
  controller.remembered.set(`${controller.pane}:${controller.region}`, event.target);
});
document.addEventListener("pointerdown", () => document.body.classList.remove("controller-input"), true);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") document.body.classList.remove("controller-input");
  if (event.target.id === "exploreCanvas") {
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    }[event.key];
    if (direction) {
      event.preventDefault();
      controllerMove(...direction);
    } else if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      controllerConfirm();
    }
    return;
  }
  if (event.target.matches?.('[data-controller][role="button"]')
    && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    event.target.click();
  }
}, true);
window.addEventListener("gamepadconnected", startControllerPolling);
window.addEventListener("gamepaddisconnected", () => {
  if ([...(navigator.getGamepads?.() || [])].some(Boolean)) return;
  if (controller.frame) cancelAnimationFrame(controller.frame);
  controller.frame = null;
  controller.buttons = [];
});
if ([...(navigator.getGamepads?.() || [])].some(Boolean)) startControllerPolling();
