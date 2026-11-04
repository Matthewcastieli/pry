(function () {
  const app = window.ElFarApp || (window.ElFarApp = {});

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
      lat: latitude,
      lng: longitude,
      time: entry.time || "just ara",
    };
  }

  app.alerts = {
    getLocalAlerts() {
      try {
        const saved = app.storage.getPendingAlerts();
        return saved
          .map(normalizeAlert)
          .filter(Boolean)
          .map((item) => ({ ...item, time: item.time || "just ara" }));
      } catch (error) {
        return [];
      }
    },

    async getCurrentAlerts() {
      const localAlerts = this.getLocalAlerts();

      if (location.protocol === "file:") {
        return localAlerts.length ? localAlerts : app.config.fallbackAlerts;
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
        return localAlerts.length ? localAlerts : app.config.fallbackAlerts;
      }
    },
  };
})();
