(function () {
  const app = window.ElFarApp || (window.ElFarApp = {});

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
    const container = app.elements.liveMap;
    const list = app.elements.alertList;
    const alerts = await app.alerts.getCurrentAlerts();

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
      marker.setAttribute("aria-label", alert.title);
      container.appendChild(marker);

      const item = document.createElement("li");
      item.className = "alert-item";
      item.innerHTML = `
        <div class="alert-meta">
          <span class="alert-pill ${alert.type}">${alert.type === "urgent" ? "Urgent" : "Normal"}</span>
          <strong>${alert.title}</strong>
        </div>
        <small>${alert.time}</small>
      `;
      list.appendChild(item);
    });

    app.elements.alertCount.textContent = `${alerts.length} actius`;
    app.elements.alertCount.classList.toggle("urgent", alerts.some((alert) => alert.type === "urgent"));
  }

  app.map = { projectToMap, renderLiveMap };
})();
