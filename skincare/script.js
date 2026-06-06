const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const stickyCta = document.querySelector("[data-sticky-cta]");
const bookingForm = document.querySelector("[data-booking-form]");
const formStatus = document.querySelector("[data-form-status]");
const year = document.querySelector("[data-year]");

const CLINIC_PHONE = "+91 63042 35143";

if (year) {
  year.textContent = new Date().getFullYear();
}

const syncHeader = () => {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 8);
};

const syncStickyCta = () => {
  if (!stickyCta) return;

  const formCard = document.querySelector("#appointment");
  const formVisible = formCard
    ? formCard.getBoundingClientRect().top < window.innerHeight - 24
      && formCard.getBoundingClientRect().bottom > 24
    : false;

  stickyCta.classList.toggle("is-visible", window.scrollY > 520 && !formVisible);
};

const syncUi = () => {
  syncHeader();
  syncStickyCta();
};

syncUi();
window.addEventListener("scroll", syncUi, { passive: true });

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

const userFacingError = (response) => {
  if (response.status === 501 || response.status === 502) {
    return `We couldn't submit your request online right now. Please call us at ${CLINIC_PHONE}.`;
  }

  return `Something went wrong. Please try again or call us at ${CLINIC_PHONE}.`;
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
        throw new Error(userFacingError(response));
      }

      const dateLabel = data.appointment?.date || "today";
      setFormStatus(
        `Thanks, ${payload.name}. Your appointment request was received on ${dateLabel}. Our clinic team will call you back shortly.`,
        "success"
      );
      bookingForm.reset();
    } catch (error) {
      setFormStatus(error.message, "error");
    } finally {
      bookingForm.classList.remove("is-submitting");
      if (submitButton) submitButton.disabled = false;
    }
  });
}
