const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const stickyCta = document.querySelector("[data-sticky-cta]");
const callbackModal = document.querySelector("[data-callback-modal]");
const callbackTriggers = document.querySelectorAll("[data-open-callback]");
const callbackCloseTargets = document.querySelectorAll("[data-close-callback]");
const callbackForms = document.querySelectorAll("[data-callback-form]");
const year = document.querySelector("[data-year]");

const CLINIC_PHONE = "+91 63042 35143";
const promoCarousel = document.querySelector("[data-promo-carousel]");
const promoTrack = document.querySelector("[data-promo-track]");
const promoSlides = document.querySelectorAll("[data-promo-slide]");
const promoDots = document.querySelectorAll("[data-promo-dot]");

if (year) {
  year.textContent = new Date().getFullYear();
}

const syncHeader = () => {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 8);
};

const syncStickyCta = () => {
  if (!stickyCta) return;
  stickyCta.classList.toggle("is-visible", window.scrollY > 520);
};

const syncUi = () => {
  syncHeader();
  syncStickyCta();
};

syncUi();
window.addEventListener("scroll", syncUi, { passive: true });

if (navToggle && nav) {
  const setNavOpen = (isOpen) => {
    nav.classList.toggle("is-open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-open", isOpen);
  };

  navToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setNavOpen(!nav.classList.contains("is-open"));
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      setNavOpen(false);
    }
  });

  document.addEventListener("click", (event) => {
    if (!nav.classList.contains("is-open")) return;
    if (event.target instanceof Node && (nav.contains(event.target) || navToggle.contains(event.target))) {
      return;
    }
    setNavOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setNavOpen(false);
    }
  });
}

const initPromoCarousel = () => {
  if (!promoCarousel || !promoTrack || promoSlides.length === 0) return;

  let activeIndex = 0;
  let timerId = null;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const intervalMs = 6000;

  const setSlide = (index) => {
    activeIndex = (index + promoSlides.length) % promoSlides.length;

    promoTrack.style.transform = `translateX(-${activeIndex * 100}%)`;

    promoSlides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === activeIndex);
    });

    promoDots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === activeIndex;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-selected", String(isActive));
    });
  };

  const stopAutoplay = () => {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  };

  const startAutoplay = () => {
    if (prefersReducedMotion || promoSlides.length < 2) return;
    stopAutoplay();
    timerId = window.setInterval(() => {
      setSlide(activeIndex + 1);
    }, intervalMs);
  };

  promoDots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      setSlide(index);
      startAutoplay();
    });
  });

  promoCarousel.addEventListener("mouseenter", stopAutoplay);
  promoCarousel.addEventListener("mouseleave", startAutoplay);
  promoCarousel.addEventListener("focusin", stopAutoplay);
  promoCarousel.addEventListener("focusout", startAutoplay);

  setSlide(0);
  startAutoplay();
};

initPromoCarousel();

const getContactScrollTarget = () => {
  const section = document.getElementById("contact");
  const location = document.getElementById("contact-location");
  if (!section) return null;
  if (!location) return section;

  const { height, width } = location.getBoundingClientRect();
  if (height > 0 || width > 0) return location;

  return location.querySelector(".contact-card") ?? section;
};

const scrollToContactLocation = (event) => {
  if (event) {
    event.preventDefault();
  }

  const scrollTarget = getContactScrollTarget();
  if (!scrollTarget) return;

  if (nav?.classList.contains("is-open")) {
    nav.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
    navToggle?.setAttribute("aria-label", "Open menu");
    document.body.classList.remove("nav-open");
  }

  const headerOffset = (header?.offsetHeight ?? 132) + 12;
  const targetTop = scrollTarget.getBoundingClientRect().top + window.scrollY - headerOffset;

  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });

  if (window.history.replaceState) {
    window.history.replaceState(null, "", "#contact");
  }
};

document.querySelectorAll('a[href="#contact"]').forEach((link) => {
  link.addEventListener("click", scrollToContactLocation);
});

if (window.location.hash === "#contact") {
  window.requestAnimationFrame(() => {
    scrollToContactLocation();
  });
}

let lastFocusedElement = null;

const openCallbackModal = () => {
  if (!callbackModal) return;

  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  callbackModal.hidden = false;
  document.body.style.overflow = "hidden";

  const nameInput = callbackModal.querySelector('input[name="name"]');
  if (nameInput instanceof HTMLInputElement) {
    window.setTimeout(() => nameInput.focus(), 0);
  }
};

const closeCallbackModal = () => {
  if (!callbackModal || callbackModal.hidden) return;

  callbackModal.hidden = true;
  document.body.style.overflow = "";

  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
};

callbackTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    openCallbackModal();
  });
});

callbackCloseTargets.forEach((target) => {
  target.addEventListener("click", closeCallbackModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCallbackModal();
  }
});

document.querySelectorAll(".faq-item").forEach((item) => {
  item.addEventListener("click", () => {
    const expanded = item.getAttribute("aria-expanded") === "true";
    item.setAttribute("aria-expanded", String(!expanded));
  });
});

const setFormStatus = (statusEl, message, status = "") => {
  if (!statusEl) return;
  statusEl.textContent = message;
  if (status) {
    statusEl.dataset.status = status;
  } else {
    delete statusEl.dataset.status;
  }
};

const userFacingError = (response) => {
  if (response.status === 501 || response.status === 502) {
    return `We couldn't submit your request online right now. Please call us at ${CLINIC_PHONE}.`;
  }

  return `Something went wrong. Please try again or call us at ${CLINIC_PHONE}.`;
};

const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
};

callbackForms.forEach((form) => {
  const statusEl = form.querySelector("[data-form-status]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');
    const name = String(formData.get("name") || "").trim();
    const phone = normalizePhone(formData.get("phone"));

    if (!name) {
      setFormStatus(statusEl, "Please enter your name.", "error");
      return;
    }

    if (phone.length !== 10) {
      setFormStatus(statusEl, "Please enter a valid 10-digit mobile number.", "error");
      return;
    }

    const payload = {
      name,
      phone,
      source: "Priyanka's Skin Care callback form",
      pageUrl: window.location.href
    };

    setFormStatus(statusEl, "Sending callback request...");
    form.classList.add("is-submitting");
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch("/api/skincare-appointment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(userFacingError(response));
      }

      setFormStatus(
        statusEl,
        `Thanks, ${name}. We received your callback request and will call you on ${phone} shortly.`,
        "success"
      );
      form.reset();

      if (callbackModal && form.closest("[data-callback-modal]")) {
        window.setTimeout(closeCallbackModal, 1800);
      }
    } catch (error) {
      setFormStatus(statusEl, error.message, "error");
    } finally {
      form.classList.remove("is-submitting");
      if (submitButton) submitButton.disabled = false;
    }
  });
});
