const form = document.querySelector("[data-leave-form]");
const submit = document.querySelector("[data-leave-submit]");
const token = new URLSearchParams(location.hash.slice(1)).get("t");

history.replaceState(null, "", `${location.pathname}${location.search}`);

if (!form || !submit || !token) {
  location.replace("/early-access/link-invalid/");
} else {
  const tokenField = document.createElement("input");
  tokenField.type = "hidden";
  tokenField.name = "token";
  tokenField.value = token;
  form.append(tokenField);
  submit.disabled = false;
}
