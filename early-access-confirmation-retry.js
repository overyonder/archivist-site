const retry = document.querySelector("[data-confirmation-retry]");
const token = new URLSearchParams(location.hash.slice(1)).get("t");

history.replaceState(null, "", `${location.pathname}${location.search}`);

if (!retry || !token) {
  location.replace("/early-access/link-invalid/");
} else {
  const confirmation = new URL(
    "https://xbwhevdunxftierqlpsr.supabase.co/functions/v1/confirm-early-access",
  );
  confirmation.searchParams.set("t", token);
  retry.href = confirmation;
  retry.hidden = false;
}
