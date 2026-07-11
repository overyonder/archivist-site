const features = [
  ["Explore the canon", "View games in context through genre family trees and platform timelines spanning the 1950s to today."],
  ["Emulator configuration", "Archivist includes more than 1,800 launch configurations and detects installed emulators."],
  ["Themes and accessibility", "Archivist supports Tinted Theming, system light and dark modes, and an 8:1 high-contrast option."],
  ["Collection verification", "Review manifests, emulators, BIOS files, selected releases, and collection state."],
  ["Genre genealogy", "Trace the games that shaped a genre and the works that followed from them."],
  ["Gamepad interface", "Navigate Archivist from the couch with documented controller hotkeys."],
  ["Live Vault updates", "NAS Historian streams filesystem changes to the desktop as new snapshot generations."],
  ["Resident compiler", "2,151,769 manifest media rows compiled in 1.314 seconds; a 222,242-entry NAS snapshot hydrates into the frontend in 420 ms."],
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
  caption.querySelector(".index").textContent = `${String(current + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
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

const historianInfo = document.querySelector("[data-historian-info]");
const historianCallout = document.querySelector("#historianCallout");
historianInfo.addEventListener("click", (event) => {
  event.stopPropagation();
  historianCallout.hidden = !historianCallout.hidden;
  historianInfo.setAttribute("aria-expanded", String(!historianCallout.hidden));
});
document.addEventListener("click", (event) => {
  if (!historianCallout.hidden && !historianCallout.contains(event.target)) {
    historianCallout.hidden = true;
    historianInfo.setAttribute("aria-expanded", "false");
  }
});

const technicalDialog = document.querySelector("#technicalDialog");
document.querySelectorAll("[data-technical-open]").forEach((button) => {
  button.addEventListener("click", () => technicalDialog.showModal());
});
document.querySelector("[data-technical-close]").addEventListener("click", () => technicalDialog.close());
technicalDialog.addEventListener("click", (event) => {
  if (event.target === technicalDialog) technicalDialog.close();
});
