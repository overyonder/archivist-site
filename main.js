const features = [
  ["System history", "Browse system families and releases on an interactive timeline."],
  ["Emulator configuration", "Archivist includes more than 1,800 launch configurations and detects installed emulators."],
  ["Themes and accessibility", "Archivist supports Tinted Theming, system light and dark modes, and an 8:1 high-contrast option."],
  ["Collection verification", "Review manifests, emulators, BIOS files, selected releases, and collection state."],
];

const slides = [...document.querySelectorAll(".slide")];
const tabs = [...document.querySelectorAll("[data-tab]")];
const caption = document.querySelector(".caption");
let current = 0;

function show(index) {
  current = (index + slides.length) % slides.length;
  slides.forEach((slide, i) => slide.classList.toggle("active", i === current));
  tabs.forEach((tab, i) => {
    tab.classList.toggle("active", i === current);
    tab.setAttribute("aria-selected", String(i === current));
  });
  caption.querySelector(".index").textContent = `${String(current + 1).padStart(2, "0")} / 04`;
  caption.querySelector("h2").textContent = features[current][0];
  caption.querySelector("p").textContent = features[current][1];
}

tabs.forEach((tab) => tab.addEventListener("click", () => show(Number(tab.dataset.tab))));
document.querySelector("[data-prev]").addEventListener("click", () => show(current - 1));
document.querySelector("[data-next]").addEventListener("click", () => show(current + 1));
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") show(current - 1);
  if (event.key === "ArrowRight") show(current + 1);
});

const technicalDialog = document.querySelector("#technicalDialog");
document.querySelector("[data-open-technicals]").addEventListener("click", () => technicalDialog.showModal());
document.querySelector("[data-close-technicals]").addEventListener("click", () => technicalDialog.close());
technicalDialog.addEventListener("click", (event) => {
  if (event.target === technicalDialog) technicalDialog.close();
});
