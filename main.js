document.documentElement.classList.add("js");

const exhibits = [
  ["The Timeline", "Systems from the 1950s to today, arranged as a living family tree of platforms and genres."],
  ["The Registry", "Every supported emulator detected, configured and kept in order — more than 1,800 launch mappings."],
  ["The Reading Room", "A selectable tint colour, system light and dark modes, and an 8:1 high-contrast option."],
  ["The Verification Desk", "Preservation catalogues, emulators, system firmware and collection state, checked and accounted for."],
  ["The Controller Wing", "In development: browse the catalogue and launch games without leaving the controller."],
  ["The Stacks, at Speed", "Archivist compiles 2,151,769 catalogue-manifest rows in 1.314 seconds. A 222,242-entry snapshot from network-attached storage is applied to the interface in 420 milliseconds."],
];

const slides = [...document.querySelectorAll(".slide")];
const tabs = [...document.querySelectorAll("[data-tab]")];
const plaque = document.querySelector(".plaque");
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
  plaque.querySelector(".plaque-index").textContent = `Exhibit ${current + 1} of ${slides.length}`;
  plaque.querySelector("h3").textContent = exhibits[current][0];
  plaque.querySelector("p").textContent = exhibits[current][1];
}

slides.forEach((slide, i) => {
  slide.id = `exhibit-slide-${i}`;
  slide.setAttribute("role", "tabpanel");
  slide.setAttribute("aria-labelledby", `exhibit-tab-${i}`);
});

tabs.forEach((tab, i) => {
  tab.id = `exhibit-tab-${i}`;
  tab.setAttribute("aria-controls", `exhibit-slide-${i}`);
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

/* Reveal sections as they enter the reading view */

const revealTargets = [...document.querySelectorAll(".reveal")];

if ("IntersectionObserver" in window && revealTargets.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  revealTargets.forEach((target) => observer.observe(target));
} else {
  revealTargets.forEach((target) => target.classList.add("in"));
}
