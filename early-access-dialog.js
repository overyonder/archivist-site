const joinEndpoint =
  "https://xbwhevdunxftierqlpsr.supabase.co/functions/v1/join-early-access";

const formMarkup = `
  <dialog class="signup-dialog" id="earlyAccessDialog">
    <div class="signup-dialog-inner">
      <button class="signup-dialog-close" type="button" aria-label="Close release-list signup">×</button>
      <p class="eyebrow">Release list</p>
      <h2>Hear when Archivist is ready.</h2>
      <p class="signup-dialog-lede">Get the founding price, early-access availability and the Archivist Free release by email.</p>
      <form class="signup-form signup-dialog-form" method="post" action="${joinEndpoint}">
        <div class="signup-dialog-fields">
          <label class="sr-only" for="dialog-early-access-email">Email address</label>
          <input id="dialog-early-access-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required>
          <button type="submit" disabled>Get notified</button>
        </div>
        <label class="signup-dialog-choice">
          <input name="product_research" type="checkbox" value="yes">
          <span>Also send occasional product notes and invitations to surveys or early testing. Optional; you can unsubscribe anytime.</span>
        </label>
        <input name="campaign_source" type="hidden">
        <input name="campaign_medium" type="hidden">
        <input name="campaign_name" type="hidden">
        <input name="campaign_content" type="hidden">
        <input name="landing_page" type="hidden">
        <input name="attribution_subject_id" type="hidden">
        <input name="signup_sources" type="hidden">
        <input name="pro_first_feature" type="hidden">
        <div class="turnstile-challenge" data-early-access-challenge></div>
        <small data-early-access-status aria-live="polite">Preparing secure signup…</small>
        <small>See how we handle your information in our <a href="privacy">privacy policy</a>.</small>
      </form>
    </div>
  </dialog>
`;

const existingForm = document.querySelector(".signup-form");

if (!existingForm) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "signup-dialog.css?site=archivist-v1";
  document.head.append(stylesheet);

  document.body.insertAdjacentHTML("beforeend", formMarkup);
  const dialog = document.querySelector("#earlyAccessDialog");
  const nav = document.querySelector(".site-header .nav");
  if (nav) {
    const link = document.createElement("a");
    link.className = "early-access-nav";
    link.href = "/#early-access";
    link.textContent = "Early access";
    const themeToggle = nav.querySelector(".theme-toggle");
    nav.insertBefore(link, themeToggle);
  }

  const openDialog = (event) => {
    event.preventDefault();
    dialog.showModal();
    dialog.querySelector('input[type="email"]').focus();
  };
  document.querySelectorAll('a[href="/#early-access"]').forEach((link) => {
    link.addEventListener("click", openDialog);
  });
  dialog.querySelector(".signup-dialog-close").addEventListener(
    "click",
    () => dialog.close(),
  );
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

await import("./early-access-form.js?site=archivist-v9");
