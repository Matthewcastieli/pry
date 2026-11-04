const $ = (id) => document.getElementById(id);

const appConfig = {
  pendingAlertsKey: "far_pending_alerts",
  savedDraftsKey: "far_my_alerts",
  fallbackAlerts: [
    { id: "A-204", type: "urgent", title: "Persona inconscient", lat: 41.387, lng: 2.168, time: "fa 2 min" },
    { id: "A-331", type: "normal", title: "Porta bloquejada", lat: 41.382, lng: 2.176, time: "fa 6 min" },
    { id: "A-449", type: "urgent", title: "Incendi petit", lat: 41.394, lng: 2.183, time: "fa 9 min" },
    { id: "A-517", type: "normal", title: "Aigua acumulada", lat: 41.379, lng: 2.156, time: "fa 12 min" },
  ],
};

const appState = {
  urgent: false,
  coords: null,
  pressTimer: null,
  holdTriggered: false,
  lastTap: 0,
  deferredPrompt: null,
  watchId: null,
};

const elements = {
  panel: $("reportPanel"),
  badge: $("typeBadge"),
  confirmation: $("confirmation"),
  locationText: $("locationText"),
  reportTitle: $("reportTitle"),
  urgentBtn: $("urgentBtn"),
  normalBtn: $("normalBtn"),
  toast: $("toast"),
  form: $("reportForm"),
};

function toast(message) {
  const el = elements.toast;
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

function setAlertTypeBadge() {
  elements.badge.textContent = appState.urgent ? "Urgent" : "Normal";
  elements.badge.classList.toggle("urgent", appState.urgent);
  elements.reportTitle.textContent = appState.urgent ? "Avís d'emergència" : "Afegeix informació";
}

function getUserTrustMap() {
  try {
    return JSON.parse(localStorage.getItem("far_user_trust") || "{}") || {};
  } catch (error) {
    return {};
  }
}

function getUserTrustScore(userName) {
  const map = getUserTrustMap();
  const safeName = (userName || "Usuari").trim() || "Usuari";
  return Number(map[safeName] ?? 50) || 50;
}

function setUserTrustScore(userName, score) {
  const map = getUserTrustMap();
  const safeName = (userName || "Usuari").trim() || "Usuari";
  map[safeName] = Math.min(100, Math.max(0, Number(score) || 0));
  localStorage.setItem("far_user_trust", JSON.stringify(map));
  return map[safeName];
}

function updateTrustBadge(userName = null) {
  const badge = document.getElementById("userTrustBadge");
  if (!badge) {
    return;
  }

  const resolvedName = userName || (document.getElementById("userNameInput")?.value || localStorage.getItem("far_user_name") || "Usuari");
  const score = getUserTrustScore(resolvedName);
  badge.textContent = `Confiança: ${score}`;
  badge.classList.toggle("low", score < 40);
  badge.classList.toggle("mid", score >= 40 && score < 75);
  badge.classList.toggle("high", score >= 75);
}

function getCurrentUserName() {
  const input = document.getElementById("userNameInput");
  const candidate = (input ? input.value.trim() : "") || localStorage.getItem("far_user_name") || "Usuari";
  const finalName = candidate.trim() || "Usuari";
  localStorage.setItem("far_user_name", finalName);
  if (input) {
    input.value = finalName;
  }
  updateTrustBadge(finalName);
  return finalName;
}

function adjustUserTrust(userName, delta) {
  const current = getUserTrustScore(userName);
  const next = setUserTrustScore(userName, current + delta);
  updateTrustBadge(userName);
  return next;
}

function getSharedAlerts() {
  return readStoredArray("far_shared_alerts");
}

function readStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function saveSharedAlerts(alerts) {
  localStorage.setItem("far_shared_alerts", JSON.stringify(alerts));
}

function openReport(isUrgent = false) {
  appState.urgent = isUrgent;
  setAlertTypeBadge();
  elements.panel.classList.remove("hidden");
  elements.confirmation.classList.add("hidden");
  elements.panel.scrollIntoView({ behavior: "smooth", block: "start" });

  if (!appState.coords) {
    locate();
  }
}

function getRiskLevel() {
  const select = document.getElementById("riskLevel");
  return select ? select.value : "possible";
}

function validateSafetyChecks({ allowQuickConfirm = false } = {}) {
  const realCheck = document.getElementById("confirmRealAlert")?.checked;
  const witnessCheck = document.getElementById("confirmWitness")?.checked;
  const riskLevel = getRiskLevel();
  const userTrust = getUserTrustScore(getCurrentUserName());

  if (allowQuickConfirm) {
    const confirmed = window.confirm("Confirma que aquest avís és real i no és una broma. Aquesta comprovació ajuda a reduir avisos falsos.");
    if (!confirmed) {
      return { ok: false, message: "Avís cancel·lat: verifica la situació abans d'enviar-lo." };
    }

    if (riskLevel === "urgent" && !appState.urgent) {
      return { ok: false, message: "L'avís urgent s'ha de marcar com a emergència real abans d'enviar-lo." };
    }

    if (userTrust < 25 && riskLevel !== "urgent") {
      return { ok: false, message: "La teva confiança actual és baixa. Verifica la situació i prova-ho de nou." };
    }

    return { ok: true, message: "" };
  }

  if (!realCheck || !witnessCheck) {
    return { ok: false, message: "Confirma que l'avís és real i que has verificat la situació." };
  }

  if (riskLevel === "urgent" && !appState.urgent) {
    return { ok: false, message: "L'avís urgent s'ha de marcar com a emergència real abans d'enviar-lo." };
  }

  if (userTrust < 20 && riskLevel === "possible") {
    return { ok: false, message: "La teva confiança és baixa. Fes servir un avís més detallat o espera a verificar la situació." };
  }

  return { ok: true, message: "" };
}

function createAlertRecord(type = "normal") {
  const description = (document.getElementById("description")?.value || "").trim() || "Sense detalls addicionals";
  const location = appState.coords || { latitude: 0, longitude: 0, accuracy: 0 };

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type,
    description,
    user: getCurrentUserName(),
    riskLevel: getRiskLevel(),
    location,
    createdAt: new Date().toISOString(),
  };
}

async function sendAlertToServer(data) {
  try {
    const response = await fetch("api/alerts.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Servidor no disponible");
    }

    const result = await response.json();
    return { ok: true, message: result.message || "L'avís s'ha enviat al servidor de prova." };
  } catch (error) {
    const pending = readStoredArray("far_pending_alerts");
    pending.push(data);
    localStorage.setItem("far_pending_alerts", JSON.stringify(pending));
    return { ok: false, message: "No s'ha pogut contactar amb el servidor. L'avís s'ha desat temporalment en aquest dispositiu." };
  }
}

async function persistAlertRecord(data, { silent = false } = {}) {
  const serverResult = await sendAlertToServer(data);

  if (serverResult.ok) {
    adjustUserTrust(data.user || "Usuari", 8);
  } else {
    adjustUserTrust(data.user || "Usuari", -12);
  }

  const nextShared = getSharedAlerts().filter((item) => item.id !== data.id);
  nextShared.push({ ...data, receivedAt: data.createdAt, user: data.user || "Usuari" });
  saveSharedAlerts(nextShared);

  const saved = getMyAlerts();
  const draftEntry = {
    id: data.id,
    type: data.type,
    description: data.description,
    user: data.user,
    location: data.location,
    locationText: data.location ? `${Number(data.location.latitude).toFixed(5)}, ${Number(data.location.longitude).toFixed(5)}` : "Ubicació no disponible",
    createdAt: data.createdAt,
  };
  const nextSaved = saved.filter((item) => item.id !== data.id);
  nextSaved.push(draftEntry);
  saveMyAlerts(nextSaved);
  renderMyAlerts();

  if (silent) {
    $("confirmationText").textContent = `${serverResult.message} · ${data.user}`;
    $("confirmation").classList.remove("hidden");
    $("confirmation").scrollIntoView({ behavior: "smooth" });
    toast(serverResult.ok ? "Avís enviat correctament." : "Avís desat localment.");
    return;
  }

  $("confirmationText").textContent = `${serverResult.message} · ${data.user}`;
  elements.panel.classList.add("hidden");
  elements.confirmation.classList.remove("hidden");
  elements.confirmation.scrollIntoView({ behavior: "smooth" });
}

elements.normalBtn.addEventListener("click", async () => {
  appState.urgent = false;
  setAlertTypeBadge();

  if (!appState.coords) {
    const ok = await locate();
    if (!ok) {
      openReport(false);
      return;
    }
  }

  const safety = validateSafetyChecks({ allowQuickConfirm: true });
  if (!safety.ok) {
    toast(safety.message);
    openReport(false);
    return;
  }

  const data = createAlertRecord("normal");
  await persistAlertRecord(data, { silent: true });
});

function startHold(event) {
  event.preventDefault();
  appState.holdTriggered = false;
  elements.urgentBtn.classList.add("holding");

  appState.pressTimer = setTimeout(() => {
    appState.holdTriggered = true;
    openReport(true);
  }, 3000);
}

function endHold() {
  clearTimeout(appState.pressTimer);
  elements.urgentBtn.classList.remove("holding");
}

elements.urgentBtn.addEventListener("pointerdown", startHold);
["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
  elements.urgentBtn.addEventListener(eventName, endHold);
});

elements.urgentBtn.addEventListener("click", () => {
  if (appState.holdTriggered) {
    appState.holdTriggered = false;
    return;
  }

  const now = Date.now();

  if (now - appState.lastTap < 450) {
    openReport(true);
    appState.lastTap = 0;
  } else {
    appState.lastTap = now;
    toast("Fes un segon toc ràpid per preparar un avís urgent, o mantén premut 3 segons.");
  }
});

async function locate() {
  if (!("geolocation" in navigator)) {
    toast("Aquest navegador no permet obtenir la ubicació.");
    return false;
  }

  elements.locationText.textContent = "Obtenint ubicació…";

  return new Promise((resolve) => {
    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    const onSuccess = (position) => {
      appState.coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy),
      };

      if (appState.watchId === null && "watchPosition" in navigator.geolocation) {
        appState.watchId = navigator.geolocation.watchPosition(
          (nextPosition) => {
            appState.coords = {
              latitude: nextPosition.coords.latitude,
              longitude: nextPosition.coords.longitude,
              accuracy: Math.round(nextPosition.coords.accuracy),
            };
            elements.locationText.textContent = `${appState.coords.latitude.toFixed(5)}, ${appState.coords.longitude.toFixed(5)} (precisió aproximada ±${appState.coords.accuracy} m)`;
          },
          () => {},
          options
        );
      }

      elements.locationText.textContent = `${appState.coords.latitude.toFixed(5)}, ${appState.coords.longitude.toFixed(5)} (precisió aproximada ±${appState.coords.accuracy} m)`;
      resolve(true);
    };

    const onError = (error) => {
      elements.locationText.textContent = "No s'ha pogut obtenir. Pots continuar sense ubicació.";
      toast(
        error.code === 1
          ? "Cal donar permís d'ubicació al navegador."
          : "No s'ha pogut obtenir la ubicació."
      );
      resolve(false);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
  });
}

$("locateBtn").addEventListener("click", locate);
$("saveDraftBtn").addEventListener("click", saveDraftAlert);

$("cancelBtn").addEventListener("click", () => {
  elements.panel.classList.add("hidden");
  appState.urgent = false;
  setAlertTypeBadge();
});

$("reportForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const send = $("sendBtn");
  send.disabled = true;
  send.textContent = "Enviant…";

  if (!appState.coords) {
    toast("Primer obtén la ubicació per enviar l'avís.");
    locate();
    send.disabled = false;
    send.textContent = "Envia l'avís";
    return;
  }

  const safety = validateSafetyChecks();
  if (!safety.ok) {
    toast(safety.message);
    send.disabled = false;
    send.textContent = "Envia l'avís";
    return;
  }

  const data = createAlertRecord(appState.urgent ? "urgent" : "normal");
  const photo = $("photoInput").files[0];
  const audio = $("audioInput").files[0];

  const result = await sendAlertToServer(data);
  if (result.ok) {
    adjustUserTrust(data.user || "Usuari", 5);
  } else {
    adjustUserTrust(data.user || "Usuari", -10);
  }
  $("confirmationText").textContent = `${result.message} · ${data.user}`;

  if (photo || audio) {
    toast("Nota: en aquesta versió les fotos i els àudios no s'envien al servidor encara.");
  }

  const sharedAlerts = getSharedAlerts();
  const updatedShared = sharedAlerts.filter((item) => item.id !== data.id);
  updatedShared.push({ ...data, receivedAt: data.createdAt, user: data.user || "Usuari" });
  saveSharedAlerts(updatedShared);

  const saved = getMyAlerts();
  const draftEntry = {
    id: data.id,
    type: data.type,
    description: data.description,
    user: data.user,
    location: appState.coords,
    locationText: appState.coords ? `${appState.coords.latitude.toFixed(5)}, ${appState.coords.longitude.toFixed(5)}` : "Ubicació no disponible",
    createdAt: data.createdAt,
  };
  const nextSaved = saved.filter((item) => item.id !== data.id);
  nextSaved.push(draftEntry);
  saveMyAlerts(nextSaved);
  renderMyAlerts();

  elements.panel.classList.add("hidden");
  elements.confirmation.classList.remove("hidden");
  elements.confirmation.scrollIntoView({ behavior: "smooth" });

  send.disabled = false;
  send.textContent = "Envia l'avís";
  $("reportForm").reset();
  appState.coords = null;
  elements.locationText.textContent = "Encara no s'ha obtingut.";
});

$("newReportBtn").addEventListener("click", () => {
  $("confirmation").classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

const FALLBACK_ALERTS = [
  { id: "A-204", type: "urgent", title: "Persona inconscient", lat: 41.387, lng: 2.168, time: "fa 2 min" },
  { id: "A-331", type: "normal", title: "Porta bloquejada", lat: 41.382, lng: 2.176, time: "fa 6 min" },
  { id: "A-449", type: "urgent", title: "Incendi petit", lat: 41.394, lng: 2.183, time: "fa 9 min" },
  { id: "A-517", type: "normal", title: "Aigua acumulada", lat: 41.379, lng: 2.156, time: "fa 12 min" },
];

function normalizeAlert(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const location = entry.location || {};
  const latitude = Number(location.latitude ?? entry.lat ?? entry.latitude);
  const longitude = Number(location.longitude ?? entry.lng ?? entry.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    id: entry.id || crypto.randomUUID?.() || `alert-${Date.now()}-${Math.random()}`,
    type: entry.type === "urgent" ? "urgent" : "normal",
    title: entry.title || entry.description || "Incidència oberta",
    user: entry.user || "Usuari",
    lat: latitude,
    lng: longitude,
    time: entry.time || "just ara",
  };
}

function getLocalAlerts() {
  return [...readStoredArray("far_pending_alerts"), ...getSharedAlerts()]
    .map(normalizeAlert)
    .filter(Boolean)
    .map((item) => ({ ...item, time: item.time || "just ara" }));
}

async function getCurrentAlerts() {
  const localAlerts = getLocalAlerts();

  if (location.protocol === "file:") {
    return localAlerts.length ? localAlerts : FALLBACK_ALERTS;
  }

  try {
    const response = await fetch("api/alerts.php", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("No se poden carregar els avisos");
    }

    const payload = await response.json();
    const serverAlerts = Array.isArray(payload?.alerts)
      ? payload.alerts
      : Array.isArray(payload)
        ? payload
        : [];

    const normalized = serverAlerts
      .map((item) => {
        const location = item.location || {};
        const lat = Number(location.latitude ?? item.lat ?? item.latitude);
        const lng = Number(location.longitude ?? item.lng ?? item.longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }

        return {
          id: item.id || `server-${Date.now()}-${Math.random()}`,
          type: item.type === "urgent" ? "urgent" : "normal",
          title: item.title || item.description || "Incidència oberta",
          lat,
          lng,
          time: item.receivedAt ? "fa uns segons" : "just ara",
        };
      })
      .filter(Boolean);

    return [...localAlerts, ...normalized].slice(0, 5);
  } catch (error) {
    return localAlerts.length ? localAlerts : FALLBACK_ALERTS;
  }
}

function projectToMap(lat, lng) {
  const minLat = 41.36;
  const maxLat = 41.405;
  const minLng = 2.145;
  const maxLng = 2.195;

  const x = ((lng - minLng) / (maxLng - minLng)) * 100;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 100;

  return {
    x: Math.min(95, Math.max(5, x)),
    y: Math.min(90, Math.max(10, y)),
  };
}

async function renderLiveMap() {
  const container = $("liveMap");
  const list = $("alertList");
  const alerts = await getCurrentAlerts();

  container.innerHTML = "";
  list.innerHTML = "";

  alerts.forEach((alert) => {
    const point = projectToMap(alert.lat, alert.lng);
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `map-marker ${alert.type}`;
    marker.style.left = `${point.x}%`;
    marker.style.top = `${point.y}%`;
    marker.title = `${alert.title} · ${alert.time}`;
    marker.setAttribute("aria-label", `${alert.title}`);
    container.appendChild(marker);

    const item = document.createElement("li");
    item.className = "alert-item";
    const metadata = document.createElement("div");
    metadata.className = "alert-meta";
    const pill = document.createElement("span");
    pill.className = `alert-pill ${alert.type}`;
    pill.textContent = alert.type === "urgent" ? "Urgent" : "Normal";
    const title = document.createElement("strong");
    title.textContent = alert.title;
    const details = document.createElement("small");
    details.textContent = `${alert.user || "Usuari"} · ${alert.time}`;
    metadata.append(pill, title);
    item.append(metadata, details);
    list.appendChild(item);
  });

  $("alertCount").textContent = `${alerts.length} actius`;
  $("alertCount").classList.toggle("urgent", alerts.some((alert) => alert.type === "urgent"));
}

renderLiveMap();
renderMyAlerts();
setInterval(renderLiveMap, 20000);

const savedUserName = localStorage.getItem("far_user_name");
if (savedUserName && $("userNameInput")) {
  $("userNameInput").value = savedUserName;
}

const MY_ALERTS_KEY = "far_my_alerts";

function getMyAlerts() {
  return readStoredArray(MY_ALERTS_KEY);
}

function saveMyAlerts(alerts) {
  localStorage.setItem(MY_ALERTS_KEY, JSON.stringify(alerts));
}

function renderMyAlerts() {
  const list = $("myAlertsList");
  if (!list) {
    return;
  }

  const alerts = getMyAlerts();
  list.innerHTML = "";

  if (!alerts.length) {
    const item = document.createElement("li");
    item.className = "draft-empty";
    item.textContent = "Encara no tens avisos guardats.";
    list.appendChild(item);
    return;
  }

  alerts
    .slice()
    .reverse()
    .forEach((alert) => {
      const item = document.createElement("li");
      item.className = "draft-item";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "draft-button";
      const pill = document.createElement("span");
      pill.className = `draft-pill ${alert.type === "urgent" ? "urgent" : "normal"}`;
      pill.textContent = alert.type === "urgent" ? "Urgent" : "Normal";
      const copy = document.createElement("span");
      copy.className = "draft-copy";
      const description = document.createElement("strong");
      description.textContent = String(alert.description || "Avís sense detalls").slice(0, 36);
      const details = document.createElement("small");
      details.textContent = `${alert.user || "Usuari"} · ${alert.locationText || "Sense ubicació"}`;
      copy.append(description, details);
      button.append(pill, copy);
      button.addEventListener("click", () => {
        $("description").value = alert.description || "";
        if (alert.location) {
          appState.coords = { ...alert.location };
          elements.locationText.textContent = `${appState.coords.latitude.toFixed(5)}, ${appState.coords.longitude.toFixed(5)} (precisió aproximada ±${appState.coords.accuracy || 30} m)`;
        }
        appState.urgent = alert.type === "urgent";
        setAlertTypeBadge();
        elements.panel.classList.remove("hidden");
        elements.confirmation.classList.add("hidden");
        elements.panel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      item.appendChild(button);
      list.appendChild(item);
    });
}

function saveDraftAlert() {
  const current = $("description").value.trim();
  const saved = getMyAlerts();
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type: appState.urgent ? "urgent" : "normal",
    description: current || "Avís sense detalls",
    user: getCurrentUserName(),
    location: appState.coords,
    locationText: appState.coords ? `${appState.coords.latitude.toFixed(5)}, ${appState.coords.longitude.toFixed(5)}` : "Ubicació no disponible",
    createdAt: new Date().toISOString(),
  };

  const filtered = saved.filter((item) => item.id !== entry.id);
  filtered.push(entry);
  saveMyAlerts(filtered);
  renderMyAlerts();
  toast("Avís guardat a la llista.");
}

$("installBtn").classList.add("hidden");

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  appState.deferredPrompt = event;
  $("installBtn").classList.remove("hidden");
});

$("installBtn").addEventListener("click", async () => {
  if (!appState.deferredPrompt) {
    return;
  }

  appState.deferredPrompt.prompt();
  await appState.deferredPrompt.userChoice;
  appState.deferredPrompt = null;
  $("installBtn").classList.add("hidden");
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.error("No s'ha pogut registrar el service worker.", error);
    });
  });
}
