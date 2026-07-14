document.querySelectorAll("[data-dialog-open]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.dialogOpen}`).showModal());
});

document.querySelectorAll(".legal-dialog").forEach((dialog) => {
  dialog.querySelector("[data-dialog-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});
