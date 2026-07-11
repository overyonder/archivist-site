const slides = [...document.querySelectorAll("[data-slide]")];
const captions = [...document.querySelectorAll("[data-caption]")];
const dots = [...document.querySelectorAll("[data-dot]")];
const slider = document.querySelector("[data-slider]");
let current = 0;
let timer;

function showSlide(index, restart = true) {
  current = (index + slides.length) % slides.length;
  slides.forEach((slide, i) => slide.classList.toggle("is-active", i === current));
  captions.forEach((caption, i) => caption.classList.toggle("is-active", i === current));
  dots.forEach((dot, i) => {
    dot.classList.toggle("is-active", i === current);
    dot.setAttribute("aria-selected", String(i === current));
  });
  if (restart) startTimer();
}

function startTimer() {
  clearInterval(timer);
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    timer = setInterval(() => showSlide(current + 1, false), 7000);
  }
}

document.querySelector("[data-prev]").addEventListener("click", () => showSlide(current - 1));
document.querySelector("[data-next]").addEventListener("click", () => showSlide(current + 1));
dots.forEach((dot) => dot.addEventListener("click", () => showSlide(Number(dot.dataset.dot))));
slider.addEventListener("mouseenter", () => clearInterval(timer));
slider.addEventListener("mouseleave", startTimer);
slider.addEventListener("focusin", () => clearInterval(timer));
slider.addEventListener("focusout", startTimer);
slider.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") showSlide(current - 1);
  if (event.key === "ArrowRight") showSlide(current + 1);
});

let touchStart = 0;
slider.addEventListener("touchstart", (event) => { touchStart = event.changedTouches[0].clientX; }, { passive: true });
slider.addEventListener("touchend", (event) => {
  const delta = event.changedTouches[0].clientX - touchStart;
  if (Math.abs(delta) > 45) showSlide(current + (delta < 0 ? 1 : -1));
}, { passive: true });

document.querySelector("[data-year]").textContent = new Date().getFullYear();
startTimer();

