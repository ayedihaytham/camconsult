import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Après un redéploiement, l'index.html en cache peut pointer vers d'anciens
// chunks JS qui n'existent plus → import dynamique en échec. On recharge une
// fois pour récupérer la version courante (garde-fou anti-boucle : 1×/minute).
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const now = Date.now();
  const last = Number(sessionStorage.getItem("chunk-reload-at") || 0);
  if (now - last > 60_000) {
    sessionStorage.setItem("chunk-reload-at", String(now));
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
