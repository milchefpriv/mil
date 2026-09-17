const CONTEST_START = new Date("2026-09-18T00:00:00+02:00");
const CONTEST_END = new Date("2026-09-27T18:00:00+02:00");

const form = document.querySelector("#contest-form");
const statusBadge = document.querySelector("#contest-status");
const closedNotice = document.querySelector("#closed-notice");
const formMessage = document.querySelector("#form-message");
const successCard = document.querySelector("#success-card");
const submitButton = form?.querySelector("button[type='submit']");

function setContestState() {
  if (!form || !statusBadge || !closedNotice) return;

  const now = new Date();

  if (now < CONTEST_START) {
    statusBadge.textContent = "Ouverture le 18 septembre";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.querySelector("span:first-child").textContent = "Ouverture le 18 septembre";
    }
    return;
  }

  if (now > CONTEST_END) {
    statusBadge.textContent = "Participations terminées";
    statusBadge.classList.add("closed");
    closedNotice.hidden = false;
    form.hidden = true;
    return;
  }

  statusBadge.textContent = "Participations ouvertes";
  if (submitButton) submitButton.disabled = false;
}

function showMessage(message) {
  if (!formMessage) return;
  formMessage.textContent = message;
  formMessage.classList.add("visible");
}

function clearMessage() {
  if (!formMessage) return;
  formMessage.textContent = "";
  formMessage.classList.remove("visible");
}

function showSuccess() {
  if (!form || !successCard) return;
  form.hidden = true;
  successCard.hidden = false;
  successCard.focus({ preventScroll: true });
  successCard.scrollIntoView({ behavior: "smooth", block: "center" });
  window.history.replaceState({}, "", window.location.pathname);
}

function validateForm() {
  if (!form) return false;
  let firstInvalidField = null;

  for (const field of form.querySelectorAll("input[required]")) {
    field.setAttribute("aria-invalid", String(!field.validity.valid));
    if (!field.validity.valid && !firstInvalidField) firstInvalidField = field;
  }

  if (firstInvalidField) {
    showMessage("Vérifiez les champs obligatoires avant de valider votre participation.");
    firstInvalidField.focus();
    return false;
  }

  return true;
}

async function submitEntry(event) {
  event.preventDefault();
  clearMessage();

  if (!form || !submitButton || !validateForm()) return;

  const now = new Date();
  if (now < CONTEST_START) {
    showMessage("Les participations ouvrent le 18 septembre 2026.");
    return;
  }
  if (now > CONTEST_END) {
    setContestState();
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector("span:first-child").textContent = "Enregistrement…";

  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) throw new Error("submission_failed");

    form.reset();
    showSuccess();
  } catch (error) {
    showMessage("La participation n’a pas pu être enregistrée. Vérifiez votre connexion et réessayez.");
    submitButton.disabled = false;
    submitButton.querySelector("span:first-child").textContent = "Je tente ma chance";
  }
}

for (const field of form?.querySelectorAll("input[required]") ?? []) {
  field.addEventListener("input", () => {
    if (field.validity.valid) field.removeAttribute("aria-invalid");
    clearMessage();
  });
}

form?.addEventListener("submit", submitEntry);
setContestState();

if (new URLSearchParams(window.location.search).get("status") === "success") {
  showSuccess();
}
