(function () {
  const app = window.ElFarApp || (window.ElFarApp = {});

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  app.storage = {
    getMyAlerts() {
      return readJson(app.config.savedDraftsKey, []);
    },
    saveMyAlerts(alerts) {
      localStorage.setItem(app.config.savedDraftsKey, JSON.stringify(alerts));
    },
    getPendingAlerts() {
      return readJson(app.config.pendingAlertsKey, []);
    },
    savePendingAlerts(alerts) {
      localStorage.setItem(app.config.pendingAlertsKey, JSON.stringify(alerts));
    },
  };
})();
