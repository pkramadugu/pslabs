const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const year = document.querySelector("[data-year]");
const apiMode = document.querySelector("[data-api-mode]");
const pincodeInput = document.querySelector("[data-pincode]");
const searchInput = document.querySelector("[data-search]");
const checkPincodeButton = document.querySelector("[data-check-pincode]");
const serviceStatus = document.querySelector("[data-service-status]");
const catalogGrid = document.querySelector("[data-catalog-grid]");
const filterButtons = document.querySelectorAll("[data-filter]");
const selectedCard = document.querySelector("[data-selected-card]");
const beneficiaryForm = document.querySelector("[data-beneficiary-form]");
const pricePanel = document.querySelector("[data-price-panel]");
const priceTotal = document.querySelector("[data-price-total]");
const priceNote = document.querySelector("[data-price-note]");
const slotsPanel = document.querySelector("[data-slots-panel]");
const slotGrid = document.querySelector("[data-slot-grid]");
const placeOrderButton = document.querySelector("[data-place-order]");
const confirmationPanel = document.querySelector("[data-confirmation-panel]");
const orderIdNode = document.querySelector("[data-order-id]");
const formStatus = document.querySelector("[data-form-status]");

const state = {
  catalog: [],
  filter: "ALL",
  query: "",
  pincode: "",
  serviceable: false,
  selectedItem: null,
  beneficiary: null,
  price: null,
  selectedSlot: null,
  orderId: ""
};

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

const setStatus = (message) => {
  if (formStatus) formStatus.textContent = message;
};

const setApiMode = (message, live = false) => {
  if (!apiMode) return;
  apiMode.textContent = message;
  apiMode.classList.toggle("is-live", live);
};

const money = (value) => {
  const amount = Number(value || 0);
  return `INR ${amount.toLocaleString("en-IN")}`;
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const priceOf = (item) => Number(item?.rate?.sellingPrice || item?.rate?.mrp || item?.rate?.listingPrice || item?.mrp || 0);

const testsOf = (item) => {
  const tests = item.testsIncluded || item.tests || [];
  if (Array.isArray(tests)) {
    return tests.map((test) => typeof test === "string" ? test : test.name).filter(Boolean);
  }
  return [];
};

const classifySku = (item) => {
  const rawType = String(item.type || item.skuType || item.productType || "").toUpperCase();
  const testCount = Number(item.noOfTestsIncluded || item.testsIncluded?.length || 1);

  if (rawType.includes("TEST") || rawType === "TSKU" || testCount <= 1) return "TEST";
  if (rawType.includes("PACKAGE") || testCount >= 20) return "PACKAGE";
  return "PROFILE";
};

const normalizeCatalog = (data) => {
  const list = data?.skuList || data?.data?.skuList || data?.products || data?.items || data?.data || [];
  if (!Array.isArray(list)) return [];

  return list.map((item, index) => ({
    id: String(item.id || item.skuId || item.code || `SKU-${index}`),
    name: String(item.name || item.productName || item.title || "Diagnostics SKU"),
    type: String(item.type || item.skuType || item.productType || "SSKU"),
    displayType: classifySku(item),
    noOfTestsIncluded: Number(item.noOfTestsIncluded || item.testsIncluded?.length || 1),
    testsIncluded: testsOf(item),
    beneficiaries: item.beneficiaries || [],
    flags: item.flags || {},
    categories: item.categories || [],
    rate: {
      currency: item.rate?.currency || "INR",
      listingPrice: String(item.rate?.listingPrice || item.rate?.mrp || item.mrp || item.price || 0),
      sellingPrice: String(item.rate?.sellingPrice || item.rate?.mrp || item.mrp || item.price || 0),
      notationalIncentive: String(item.rate?.notationalIncentive || 0)
    }
  }));
};

const callProxy = async (action, payload = {}) => {
  const response = await fetch("/api/thyrocare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload })
  });

  let body = {};
  try {
    body = await response.json();
  } catch (error) {
    body = {};
  }

  if (!response.ok) {
    throw new Error(body.error || `Thyrocare proxy failed with ${response.status}`);
  }

  return body;
};

const visibleCatalog = () => {
  const query = state.query.toLowerCase().trim();
  return state.catalog
    .filter((item) => state.filter === "ALL" || item.displayType === state.filter)
    .filter((item) => {
      if (!query) return true;
      const haystack = [item.name, item.displayType, ...testsOf(item)].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .slice(0, 5);
};

const renderCatalog = () => {
  if (!catalogGrid) return;
  const items = visibleCatalog();

  if (items.length === 0) {
    catalogGrid.innerHTML = '<div class="empty-state">No packages, profiles, or tests available. Confirm backend credentials and catalog API access.</div>';
    return;
  }

  catalogGrid.innerHTML = items.map((item) => {
    const tests = testsOf(item).slice(0, 4);
    const isSelected = state.selectedItem?.id === item.id;
    return `
      <article class="catalog-card${isSelected ? " is-selected" : ""}">
        <div class="card-topline">
          <span class="sku-type">${escapeHtml(item.displayType)}</span>
          <span class="test-count">${item.noOfTestsIncluded || tests.length || 1} tests</span>
        </div>
        <h3>${escapeHtml(item.name)}</h3>
        <ul class="included-tests">
          ${tests.map((test) => `<li>${escapeHtml(test)}</li>`).join("") || "<li>Catalog test details unavailable</li>"}
        </ul>
        <div class="price-row">
          <strong>${money(priceOf(item))}</strong>
          <small>${item.rate?.currency || "INR"}</small>
        </div>
        <button class="button button-primary" type="button" data-add-cart="${item.id}">Add to cart</button>
      </article>
    `;
  }).join("");
};

const updateStep = (step) => {
  const order = ["cart", "beneficiary", "slots", "confirmation"];
  const activeIndex = order.indexOf(step);
  document.querySelectorAll("[data-step-pill]").forEach((pill) => {
    const name = pill.dataset.stepPill;
    const itemIndex = order.indexOf(name);
    pill.classList.toggle("is-active", name === step);
    pill.classList.toggle("is-complete", itemIndex >= 0 && itemIndex < activeIndex);
  });
};

const updateSelectedCard = () => {
  if (!selectedCard) return;
  if (!state.selectedItem) {
    selectedCard.innerHTML = "<strong>No test selected yet.</strong><span>Choose Add to cart from a package, profile, or test above.</span>";
    return;
  }

  selectedCard.innerHTML = `
    <strong>${escapeHtml(state.selectedItem.name)}</strong>
    <span>${escapeHtml(state.selectedItem.displayType)} · ${money(priceOf(state.selectedItem))} · ${state.pincode ? `Pincode ${escapeHtml(state.pincode)}` : "Pincode pending"}</span>
  `;
};

const hydrateCatalog = async () => {
  setApiMode("Connecting to Thyrocare sandbox catalog...");
  renderCatalog();

  try {
    const data = await callProxy("catalog", {
      minPrice: 0,
      maxPrice: 100000,
      gender: "MALE",
      page: 1,
      pageSize: 25
    });
    state.catalog = normalizeCatalog(data);
    setApiMode("Connected to Thyrocare sandbox via PSLabs backend proxy.", true);
  } catch (error) {
    state.catalog = [];
    setApiMode(`Sandbox catalog unavailable: ${error.message}`);
  }

  renderCatalog();
};

const checkServiceability = async () => {
  const pincode = String(pincodeInput?.value || "").trim();

  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    state.serviceable = false;
    state.pincode = "";
    if (serviceStatus) {
      serviceStatus.textContent = "Enter a valid 6 digit pincode.";
      serviceStatus.className = "service-status is-bad";
    }
    return false;
  }

  state.pincode = pincode;

  try {
    const data = await callProxy("pincodes");
    const serviceTypes = data?.serviceTypes || data?.data?.serviceTypes || [];
    const pincodes = serviceTypes.flatMap((service) => service.pincodes || []);
    state.serviceable = pincodes.map(String).includes(pincode);
  } catch (error) {
    state.serviceable = false;
    if (serviceStatus) {
      serviceStatus.textContent = `Serviceability API failed: ${error.message}`;
      serviceStatus.className = "service-status is-bad";
    }
    return false;
  }

  if (serviceStatus) {
    serviceStatus.textContent = state.serviceable
      ? `Home collection is serviceable for ${pincode}.`
      : `Home collection is not serviceable for ${pincode}.`;
    serviceStatus.className = `service-status ${state.serviceable ? "is-ok" : "is-bad"}`;
  }

  updateSelectedCard();
  return state.serviceable;
};

const addToCart = async (itemId) => {
  const item = state.catalog.find((candidate) => candidate.id === itemId);
  if (!item) return;

  if (!state.serviceable) {
    const canProceed = await checkServiceability();
    if (!canProceed) {
      setStatus("Check a serviceable pincode before adding to cart.");
      return;
    }
  }

  state.selectedItem = item;
  state.price = null;
  state.selectedSlot = null;
  state.orderId = "";

  try {
    await callProxy("session");
    setStatus("DSA login completed through PSLabs backend. Add beneficiary details.");
  } catch (error) {
    state.selectedItem = null;
    updateSelectedCard();
    renderCatalog();
    setStatus(`Add to cart failed during DSA login: ${error.message}`);
    return;
  }

  updateStep("beneficiary");
  updateSelectedCard();
  renderCatalog();
  if (pricePanel) pricePanel.hidden = true;
  if (slotsPanel) slotsPanel.hidden = true;
  if (confirmationPanel) confirmationPanel.hidden = true;
  document.querySelector("#checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const buildPatient = (formData) => ({
  name: String(formData.get("name") || "").trim(),
  gender: String(formData.get("gender") || "").trim(),
  age: Number(formData.get("age")),
  ageType: "YEAR",
  contactNumber: String(formData.get("phone") || "").trim(),
  email: String(formData.get("email") || "").trim(),
  address: String(formData.get("address") || "").trim()
});

const buildPricePayload = (patient) => ({
  patients: [
    {
      name: patient.name,
      gender: patient.gender,
      age: patient.age,
      ageType: patient.ageType,
      items: [
        {
          id: state.selectedItem.id,
          type: state.selectedItem.type,
          name: state.selectedItem.name,
          rate: {
            currency: "INR",
            mrp: String(priceOf(state.selectedItem))
          }
        }
      ]
    }
  ],
  discounts: [],
  incentivePasson: {
    type: "",
    value: ""
  },
  isReportHardCopyRequired: false
});

const buildSlotsPayload = (patient, appointmentDate) => ({
  appointmentDate,
  pincode: Number(state.pincode),
  patients: [
    {
      name: patient.name,
      gender: patient.gender,
      age: patient.age,
      ageType: patient.ageType,
      items: [
        {
          id: state.selectedItem.id,
          type: state.selectedItem.type,
          name: state.selectedItem.name
        }
      ]
    }
  ]
});

const buildOrderPayload = () => {
  const patient = state.beneficiary;
  const address = patient.address;

  return {
    address: {
      houseNo: "",
      street: address,
      addressLine1: address,
      addressLine2: "",
      landmark: "",
      city: "",
      state: "",
      country: "India",
      pincode: Number(state.pincode)
    },
    email: patient.email,
    contactNumber: patient.contactNumber,
    appointment: {
      date: patient.appointmentDate,
      startTime: state.selectedSlot.startTime,
      timeZone: "IST"
    },
    origin: {
      platform: "PSLabs Website",
      appId: "pslabs-diagnostics",
      portalType: "B2C",
      enteredBy: "PSLabs Website",
      source: "B2C-CREATE-ORDER-API"
    },
    referredBy: {
      doctorId: "",
      doctorName: ""
    },
    paymentDetails: {
      payType: "POSTPAID"
    },
    attributes: {
      remarks: "Website diagnostics booking",
      phleboNotes: "",
      campId: null,
      isReportHardCopyRequired: false,
      refOrderNo: `PSL-${Date.now()}`,
      collectionType: "HOME_COLLECTION",
      alertMessage: [""]
    },
    config: {
      communication: {
        shareReport: true,
        shareReceipt: true,
        shareModes: {
          whatsapp: true,
          email: true
        }
      }
    },
    patients: [
      {
        name: patient.name,
        gender: patient.gender,
        age: patient.age,
        ageType: patient.ageType,
        contactNumber: patient.contactNumber,
        email: patient.email,
        attributes: {
          ulcUniqueCode: "",
          patientAddress: address,
          externalPatientId: ""
        },
        items: [
          {
            id: state.selectedItem.id,
            type: state.selectedItem.type,
            name: state.selectedItem.name,
            origin: {
              enteredBy: "PSLabs Website",
              platform: "web"
            }
          }
        ],
        documents: []
      }
    ],
    price: {
      discounts: [],
      incentivePasson: {
        type: "",
        value: ""
      }
    },
    orderOptions: {
      isPdpcOrder: false
    }
  };
};

const renderPrice = (data) => {
  const netPayable = data?.rates?.netPayableAmount || data?.data?.rates?.netPayableAmount || 0;
  state.price = Number(netPayable || 0);

  if (priceTotal) priceTotal.textContent = money(state.price);
  if (priceNote) priceNote.textContent = "Cart price returned by Thyrocare price breakup API.";
  if (pricePanel) pricePanel.hidden = false;
};

const renderSlots = (slots) => {
  const normalizedSlots = slots.map((slot, index) => ({
    id: String(slot.id || index + 1),
    startTime: String(slot.startTime || slot.time || slot),
    endTime: String(slot.endTime || ""),
    durationInMin: Number(slot.durationInMin || 30)
  })).slice(0, 12);

  if (slotGrid) {
    slotGrid.innerHTML = normalizedSlots.length
      ? normalizedSlots.map((slot) => `
        <button type="button" data-slot-id="${escapeHtml(slot.id)}" data-slot-start="${escapeHtml(slot.startTime)}">
          ${escapeHtml(slot.startTime)}${slot.endTime ? ` - ${escapeHtml(slot.endTime)}` : ""}
        </button>
      `).join("")
      : '<div class="empty-state">No slots returned for this date and pincode.</div>';
  }

  state.selectedSlot = null;
  if (placeOrderButton) placeOrderButton.disabled = true;
  if (slotsPanel) slotsPanel.hidden = false;
  updateStep("slots");
};

const handleBeneficiarySubmit = async (event) => {
  event.preventDefault();

  if (!state.selectedItem) {
    setStatus("Add a package, profile, or test to cart first.");
    return;
  }

  if (!state.serviceable) {
    setStatus("Check a serviceable pincode before continuing.");
    return;
  }

  const formData = new FormData(beneficiaryForm);
  const patient = buildPatient(formData);
  const appointmentDate = String(formData.get("appointmentDate") || "").trim();

  if (!patient.name || !patient.contactNumber || !patient.age || !patient.gender || !patient.address || !appointmentDate) {
    setStatus("Complete beneficiary details before continuing.");
    return;
  }

  state.beneficiary = { ...patient, appointmentDate };
  updateStep("beneficiary");
  setStatus("Calling Thyrocare cart price breakup API...");

  try {
    const priceData = await callProxy("priceBreakup", buildPricePayload(patient));
    renderPrice(priceData);
  } catch (error) {
    setStatus(`Price breakup failed: ${error.message}`);
    return;
  }

  setStatus("Searching Thyrocare home collection slots...");

  try {
    const slotData = await callProxy("slots", buildSlotsPayload(patient, appointmentDate));
    renderSlots(slotData?.slots || slotData?.data?.slots || []);
    setStatus("Slots loaded from Thyrocare sandbox.");
  } catch (error) {
    setStatus(`Slot search failed: ${error.message}`);
  }
};

const placeOrder = async () => {
  if (!state.selectedSlot || !state.beneficiary || !state.selectedItem) {
    setStatus("Select a slot before placing the order.");
    return;
  }

  setStatus("Placing Thyrocare sandbox order...");

  try {
    const orderData = await callProxy("createOrder", buildOrderPayload());
    state.orderId = orderData?.orderId || orderData?.orderNo || orderData?.data?.orderId || orderData?.data?.orderNo || "";
  } catch (error) {
    setStatus(`Order creation failed: ${error.message}`);
    return;
  }

  if (!state.orderId) {
    setStatus("Order API responded without an orderId.");
    return;
  }

  if (orderIdNode) orderIdNode.textContent = `Order ID: ${state.orderId}`;
  if (confirmationPanel) confirmationPanel.hidden = false;
  updateStep("confirmation");
  setStatus("Order confirmed through Thyrocare sandbox.");
  confirmationPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
};

if (searchInput) {
  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    renderCatalog();
  });
}

if (checkPincodeButton) {
  checkPincodeButton.addEventListener("click", checkServiceability);
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter || "ALL";
    filterButtons.forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
    renderCatalog();
  });
});

if (catalogGrid) {
  catalogGrid.addEventListener("click", (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest("[data-add-cart]") : null;
    if (!button) return;
    addToCart(button.dataset.addCart);
  });
}

if (beneficiaryForm) {
  beneficiaryForm.addEventListener("submit", handleBeneficiarySubmit);
}

if (slotGrid) {
  slotGrid.addEventListener("click", (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest("[data-slot-id]") : null;
    if (!button) return;
    slotGrid.querySelectorAll("button").forEach((candidate) => candidate.classList.remove("is-selected"));
    button.classList.add("is-selected");
    state.selectedSlot = {
      id: button.dataset.slotId,
      startTime: button.dataset.slotStart
    };
    if (placeOrderButton) placeOrderButton.disabled = false;
    setStatus(`Selected ${state.selectedSlot.startTime} IST.`);
  });
}

if (placeOrderButton) {
  placeOrderButton.addEventListener("click", placeOrder);
}

hydrateCatalog();
updateSelectedCard();
