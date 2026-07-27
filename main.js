const features = [
  ["A curated history.", "View games in context through genre family trees and platform timelines spanning the 1950s to today."],
  ["Ready to play.", "Archivist maps 190 emulator definitions to 840 gaming systems and detects installed emulators."],
  ["Your colours.", "Choose a tint, follow the system light or dark mode, or use the 8:1 high-contrast option."],
  ["Verify your collection.", "Check preservation catalogues, emulators, system firmware, selected releases and collection state."],
  ["Built for a controller.", "In development: browse the catalogue and launch games from the gamepad interface."],
];

const slides = [...document.querySelectorAll(".slide")];
const tabs = [...document.querySelectorAll("[data-tab]")];
const caption = document.querySelector(".caption");
let current = 0;

function show(index) {
  current = (index + slides.length) % slides.length;
  slides.forEach((slide, i) => {
    const active = i === current;
    slide.classList.toggle("active", active);
    slide.setAttribute("aria-hidden", String(!active));
    slide.toggleAttribute("inert", !active);
  });
  tabs.forEach((tab, i) => {
    const active = i === current;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  caption.querySelector(".index").textContent = `${String(current + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
  caption.querySelector("h2").textContent = features[current][0];
  caption.querySelector("p").textContent = features[current][1];
}

slides.forEach((slide, i) => {
  slide.id = `feature-slide-${i}`;
  slide.setAttribute("role", "tabpanel");
  slide.setAttribute("aria-labelledby", `feature-tab-${i}`);
});

tabs.forEach((tab, i) => {
  tab.id = `feature-tab-${i}`;
  tab.setAttribute("aria-controls", `feature-slide-${i}`);
  tab.addEventListener("click", () => show(i));
  tab.addEventListener("keydown", (event) => {
    const next = event.key === "ArrowLeft" ? i - 1
      : event.key === "ArrowRight" ? i + 1
      : event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : null;
    if (next === null) return;
    event.preventDefault();
    show(next);
    tabs[current].focus();
  });
});
document.querySelector("[data-prev]").addEventListener("click", () => show(current - 1));
document.querySelector("[data-next]").addEventListener("click", () => show(current + 1));
show(current);
