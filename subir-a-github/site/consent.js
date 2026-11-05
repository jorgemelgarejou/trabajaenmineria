// Aviso de cookies (Ley 21.719): estadísticas y anuncios personalizados solo si la persona acepta.
// Usa el modo de consentimiento de Google: el <head> parte con todo "denied" y aquí se actualiza.
// La elección se recuerda en este navegador; el enlace "Preferencias de cookies" vuelve a mostrar el aviso.
(function () {
  const KEY = "tem:consent";
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* sin almacenamiento: se pregunta en cada visita */ } };

  function apply(choice) {
    const v = choice === "si" ? "granted" : "denied";
    if (typeof gtag === "function") {
      gtag("consent", "update", { analytics_storage: v, ad_storage: v, ad_user_data: v, ad_personalization: v });
    }
  }

  function show() {
    if (document.getElementById("cookie-bar")) return;
    const bar = document.createElement("div");
    bar.id = "cookie-bar";
    bar.className = "cookie-bar";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Aviso de cookies");
    bar.innerHTML =
      '<p><b>Usamos cookies</b> para medir las visitas y mostrar anuncios. Tú decides si las aceptas; el sitio funciona igual. ' +
      '<a href="privacidad.html#cookies">Más información</a></p>' +
      '<div class="cookie-actions">' +
      '<button type="button" class="more" data-c="no">Rechazar</button>' +
      '<button type="button" class="btn" data-c="si">Aceptar</button>' +
      "</div>";
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("[data-c]");
      if (!b) return;
      save(b.dataset.c);
      apply(b.dataset.c);
      bar.remove();
    });
    document.body.appendChild(bar);
  }

  const choice = read();
  if (choice) apply(choice); else show();

  // Cualquier enlace con data-cookies (pie de página) vuelve a abrir el aviso
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-cookies]")) { e.preventDefault(); show(); }
  });
})();
