const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const bookingForm = document.querySelector("[data-booking-form]");
const formStatus = document.querySelector("[data-form-status]");
const year = document.querySelector("[data-year]");

if (year) {
  year.textContent = new Date().getFullYear();
}

const syncHeader = () => {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 8);
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open menu");
    }
  });
}

document.querySelectorAll(".faq-item").forEach((item) => {
  item.addEventListener("click", () => {
    const expanded = item.getAttribute("aria-expanded") === "true";
    item.setAttribute("aria-expanded", String(!expanded));
  });
});

const setFormStatus = (message, status = "") => {
  if (!formStatus) return;
  formStatus.textContent = message;
  if (status) {
    formStatus.dataset.status = status;
  } else {
    delete formStatus.dataset.status;
  }
};

if (bookingForm && formStatus) {
  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(bookingForm);
    const submitButton = bookingForm.querySelector('button[type="submit"]');
    const payload = {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      concern: String(formData.get("concern") || "").trim(),
      preferredDay: String(formData.get("preferred-day") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      source: "Priyanka's Skin Care website",
      pageUrl: window.location.href
    };

    setFormStatus("Sending appointment request...");
    bookingForm.classList.add("is-submitting");
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch("/api/skincare-appointment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to submit appointment request right now.");
      }

      const sheetSaved = data.integrations?.googleSheets?.ok;
      const whatsappSent = data.integrations?.whatsapp?.ok;
      const suffix = sheetSaved && whatsappSent
        ? " We saved it to Google Sheets and sent the WhatsApp alert."
        : " The clinic alert workflow accepted it.";

      setFormStatus(`Thanks, ${payload.name}. Your appointment request has been received.${suffix}`, "success");
      bookingForm.reset();
    } catch (error) {
      setFormStatus(error.message, "error");
    } finally {
      bookingForm.classList.remove("is-submitting");
      if (submitButton) submitButton.disabled = false;
    }
  });
}
