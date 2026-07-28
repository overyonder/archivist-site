# Archivist infrastructure operations

This checklist records controls that remain manual or require evidence outside
OpenTofu. Do not store secrets, recovery codes, access keys or support-message
contents here; record only the verification date and a non-secret evidence
reference.

## Immediate controls

| Control | Status | Last verified | Evidence or next action |
| --- | --- | --- | --- |
| AWS root access keys | **Open: one key exists** | 2026-07-27 | Sign in as AWS root, delete the root access key, then verify `RootAccessKeys = 0` through the IAM account summary. Do not delete the `archivist-provisioner` key in its place. |
| AWS root MFA | Verified enabled | 2026-07-27 | IAM account summary reported `AccountMFAEnabled = 1`. Review the physical recovery path separately. |
| SES production access | **Open: sandboxed** | 2026-07-27 | Continue the AWS Support production-access case. Domain, DKIM, MAIL FROM and event transport are healthy. |
| Home Pi-hole analytics allowlist | Verified | 2026-07-27 | Both Cloudflare Insights hostnames are exact-allowlisted and resolve through `shrike`; the Pi-hole installation itself is not currently declaratively managed. |
| OpenTofu state recovery | NAS copy verified; remote backend open | 2026-07-27 | A checksum-verified encrypted state copy exists under `/mnt/archive/backups/archivist/opentofu/`. Continue using the apply wrapper; select a private remote backend before moving account-level resources. |
| Supabase database recovery | Encrypted export verified; restore drill open | 2026-07-27 | The nightly timer and first age-encrypted custom-format dump completed with a valid checksum. Complete a YubiKey decryption and isolated restore drill before treating recovery as fully demonstrated. |

## Provider ownership and recovery

Verify these every six months and after any ownership, device or payment
change:

- MFA is enabled for AWS root, Cloudflare, GitHub, Supabase, Resend, the
  registrar and the billing email account.
- Recovery codes are current, readable and stored in the offline recovery
  system; the storage location is recorded without copying the codes here.
- At least two working recovery paths exist for the domain registrar and
  provider-owner accounts.
- Billing contacts, cards and budget notifications are current.
- Provider ownership and support-ticket access do not depend on a single
  browser profile or device.
- The registrar account owns `over-yonder.tech`; Fastmail owns mailbox and
  alias configuration; DNS records for both remain represented in the shared
  foundation state.
- Cloudflare DNSSEC reports active and the registrar publishes the matching DS
  record. Registrar publication remains a controlled manual step.

## Credential rotation

- Keep API bootstrap tokens and one-time Resend key material in SOPS. Record the
  creation, deployment, verification and revocation dates without recording
  token values.
- Verify the `archivist-production` Resend key is sending-only and restricted
  to `over-yonder.tech` after every rotation. Resend's API does not expose those
  restrictions after key creation, so retain dashboard evidence.
- Replace the long-lived `archivist-provisioner` administrator key with
  short-lived GitHub OIDC role credentials after the remote state backend is
  established. Revoke the key only after an OIDC deployment and rollback test.
- Keep GitHub deployment secrets manual/SOPS-backed until a private remote
  state is selected. Never commit their plaintext or encrypted state to this
  public repository.

## Production checks

- Compare initial Canon and Atlas emphasis with
  `select * from public.feature_emphasis_summary order by initial_feature;`
  using a service-role or direct database session. Treat confirmed signups as
  the primary result; card selections are supporting evidence.
- Resend tracking remains disabled and TLS remains enforced. SES tracking must
  remain privacy-equivalent before switching providers.
- Review failed, suppressed and dead-letter deliveries, oldest queue age,
  webhook rejections and reconciliation failures before each notification.
- Verify the database backup job, backup age, decryptability and periodic
  isolated restore.
- Confirm Cloudflare Web Analytics automatic injection remains enabled and EU
  exclusion remains deliberate. Do not add manual beacon snippets.
- Confirm the home Pi-hole allowlist still contains
  `static.cloudflareinsights.com` and `cloudflareinsights.com` when testing
  first-party analytics from the home network.
