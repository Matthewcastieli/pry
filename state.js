window.ElFarApp = window.ElFarApp || {};

window.ElFarApp.config = {
  pendingAlertsKey: "far_pending_alerts",
  savedDraftsKey: "far_my_alerts",
  fallbackAlerts: [
    { id: "A-204", type: "urgent", title: "Persona inconscient", lat: 41.387, lng: 2.168, time: "fa 2 min" },
    { id: "A-331", type: "normal", title: "Porta bloquejada", lat: 41.382, lng: 2.176, time: "fa 6 min" },
    { id: "A-449", type: "urgent", title: "Incendi petit", lat: 41.394, lng: 2.183, time: "fa 9 min" },
    { id: "A-517", type: "normal", title: "Aigua acumulada", lat: 41.379, lng: 2.156, time: "fa 12 min" },
  ],
};

window.ElFarApp.state = {
  urgent: false,
  coords: null,
  pressTimer: null,
  holdTriggered: false,
  lastTap: 0,
  deferredPrompt: null,
};

window.ElFarApp.elements = {
  panel: document.getElementById("reportPanel"),
  badge: document.getElementById("typeBadge"),
  confirmation: document.getElementById("confirmation"),
  locationText: document.getElementById("locationText"),
  reportTitle: document.getElementById("reportTitle"),
  urgentBtn: document.getElementById("urgentBtn"),
  normalBtn: document.getElementById("normalBtn"),
  toast: document.getElementById("toast"),
  form: document.getElementById("reportForm"),
  liveMap: document.getElementById("liveMap"),
  alertList: document.getElementById("alertList"),
  alertCount: document.getElementById("alertCount"),
  myAlertsList: document.getElementById("myAlertsList"),
  locateBtn: document.getElementById("locateBtn"),
  saveDraftBtn: document.getElementById("saveDraftBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  sendBtn: document.getElementById("sendBtn"),
  installBtn: document.getElementById("installBtn"),
  description: document.getElementById("description"),
  photoInput: document.getElementById("photoInput"),
  audioInput: document.getElementById("audioInput"),
};
