const policyLinks = document.querySelector(".footer-policies, .legal-links");

if (policyLinks) {
  policyLinks.insertAdjacentHTML("beforeend", `
    <i aria-hidden="true">|</i>
    <button type="button" data-dialog-open="ownershipDialog">Ownership</button>
  `);

  document.body.insertAdjacentHTML("beforeend", `
    <dialog class="legal-dialog ownership-dialog" id="ownershipDialog">
      <div>
        <h2>Your copy stays yours.</h2>
        <p>Archivist Free and purchased Pro capabilities will work offline without periodic activation, a remote kill switch, hardware locking, or activation counts. Licences will be verified locally. Losing over|yonder’s servers won’t disable the application or content already issued to you, and the end of a content-update period will only limit access to newer packs.</p>
        <h3>If Archivist shuts down, we will:</h3>
        <ol>
          <li>Give customers reasonable notice and a final opportunity to download a complete ownership archive: installer, licence, eligible content packs, signed manifests, checksums, public verification keys, and recovery instructions.</li>
          <li>Publish the final Free installer and its verification material under terms that allow independent public mirroring.</li>
          <li>Publish an inspectable continuity build with account and local licence enforcement, packing, and obfuscation removed, while respecting third-party redistribution rights.</li>
          <li>Publish the licence, content-pack, and release-manifest formats with standalone verification and recovery tools.</li>
          <li>Leave issued licences and content packs valid. We won’t ship a shutdown switch or publish private keys that could be used to forge historical releases.</li>
        </ol>
        <p>Hosted services such as sync or hosted storage require operating infrastructure and may end with it. Their loss won’t disable local Free or purchased Pro capabilities, or content you have retained. We’ll take these continuity actions wherever advance action remains possible.</p>
        <button type="button" data-dialog-close>Understood</button>
      </div>
    </dialog>
  `);
}

document.querySelectorAll("[data-dialog-open]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.dialogOpen}`).showModal());
});

document.querySelectorAll(".legal-dialog").forEach((dialog) => {
  dialog.querySelector("[data-dialog-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});
