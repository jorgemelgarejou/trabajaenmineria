// Cursos recomendados de OTEC y escuelas asociadas (config.js > cursos), con enlace de referido.
// Llena cada contenedor [data-cursos]: data-cat="licencias,seguridad" o data-cargo="operador-de-equipos".
// Si no hay cursos para ese contenedor, en /cursos muestra una invitación a OTEC; en otras páginas lo oculta.
(function () {
  const cfg = window.TEM_CONFIG || {};
  const hoy = new Date();
  const lista = (cfg.cursos || []).filter((c) => c && c.nombre && c.otec && /^https:\/\//.test(c.url || "") &&
    (!c.desde || new Date(c.desde + "T00:00:00") <= hoy) && (!c.hasta || new Date(c.hasta + "T23:59:59") >= hoy));

  function utm(url, ubicacion) {
    try {
      const u = new URL(url);
      if (!u.searchParams.has("utm_source")) {
        u.searchParams.set("utm_source", "trabajaenmineria");
        u.searchParams.set("utm_medium", "referido");
        u.searchParams.set("utm_campaign", ubicacion);
      }
      return u.toString();
    } catch (e) { return url; }
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  function card(c, ubicacion) {
    const a = el("a", "curso-card");
    a.href = utm(c.url, ubicacion); a.target = "_blank"; a.rel = "sponsored noopener";
    a.dataset.otec = c.otec; a.dataset.curso = c.nombre; a.dataset.ubicacion = ubicacion;
    if (/^(https:\/\/|\/)/.test(c.logo || "")) { const i = el("img", "curso-logo"); i.src = c.logo; i.alt = ""; i.loading = "lazy"; i.width = 48; i.height = 48; a.appendChild(i); }
    const t = el("span", "curso-text");
    t.appendChild(el("small", "", c.otec));
    t.appendChild(el("b", "", c.nombre));
    const meta = [c.modalidad, c.ciudad, c.duracion, c.precio].filter(Boolean).join(" · ");
    if (meta) t.appendChild(el("span", "", meta));
    if (c.sence) t.appendChild(el("em", "curso-sence", "Código SENCE " + c.sence));
    a.appendChild(t);
    a.appendChild(el("span", "curso-cta", c.cta || "Ver curso"));
    return a;
  }

  document.querySelectorAll("[data-cursos]").forEach((box) => {
    const cats = (box.dataset.cat || "").split(",").filter(Boolean);
    const cargo = box.dataset.cargo || "";
    const ubicacion = box.dataset.cursos || "cursos";
    const items = lista.filter((c) => (!cats.length || cats.indexOf(c.categoria) >= 0) && (!cargo || !c.cargos || c.cargos.indexOf(cargo) >= 0))
      .slice(0, +box.dataset.max || 6);
    const grid = box.querySelector(".curso-grid") || box;
    if (items.length) {
      items.forEach((c) => grid.appendChild(card(c, ubicacion)));
      box.hidden = false;
      const nota = box.querySelector(".curso-nota"); if (nota) nota.hidden = false;
    } else if (box.dataset.vacio === "otec") {
      box.hidden = false;
      const inv = box.querySelector(".curso-vacio"); if (inv) inv.hidden = false;
    } else {
      box.hidden = true;
    }
  });

  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a.curso-card");
    if (a && window.track) window.track("click_curso", { otec: a.dataset.otec || "", curso: a.dataset.curso || "", ubicacion: a.dataset.ubicacion || "" });
  });
})();
