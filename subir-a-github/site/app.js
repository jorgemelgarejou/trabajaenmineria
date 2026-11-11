// Front-end del agregador: lee data/jobs.json, filtra, guarda favoritos y pinta resultados con anuncios intercalados.
(function () {
  const PAGE = 20;            // ofertas por página
  const AD_EVERY = 8;         // un anuncio cada N ofertas (AdSense se configura en config.js)
  const NEW_HOURS = 48;       // marca "Nuevo"
  const ads = window.TEM_ADS || { enabled: false, fill() {} };
  const track = window.track || function () {}; // Google Analytics (definido en el <head>)
  const SAVED_KEY = "tem:saved";

  const REGIONS = [
    "Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso",
    "Metropolitana", "O'Higgins", "Maule", "Ñuble", "Biobío", "Araucanía", "Los Ríos",
    "Los Lagos", "Aysén", "Magallanes"
  ];
  const CATEGORIES = ["Operador", "Mantención", "Ingeniería", "Geología", "Prevención", "Eléctrico", "Conductor", "Administración"];
  const SHIFT_RE = /\b(4x3|5x2|7x7|10x10|14x14|20x10|4x4|8x6)\b/i;

  const ICON = {
    company: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 21V5l8-3v19M12 21h8V9l-8-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    pin: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    money: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>',
    save: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    saved: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" fill="currentColor"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4.5 8.5h3v11h-3zM6 3.5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM10 8.5h2.9v1.5h.04c.4-.76 1.38-1.56 2.85-1.56 3.05 0 3.61 2 3.61 4.6v6.46h-3v-5.73c0-1.37-.02-3.13-1.9-3.13-1.91 0-2.2 1.49-2.2 3.03v5.83H10z" fill="currentColor"/></svg>'
  };

  const $ = (id) => document.getElementById(id);
  const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  let all = [];
  let filtered = [];
  let shown = 0;
  let category = "";
  let onlySaved = false;
  let saved = new Set(readSaved());

  const params = new URLSearchParams(location.search);
  $("q").value = params.get("q") || "";
  category = params.get("cat") || "";
  onlySaved = params.get("guardados") === "1";

  for (const r of REGIONS) $("region").add(new Option(r, r));
  $("region").value = params.get("region") || "";
  $("shift").value = params.get("turno") || "";
  $("fecha").value = params.get("fecha") || "";

  for (const c of CATEGORIES) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c;
    b.onclick = () => { setCategory(category === c ? "" : c); apply(true); };
    $("chips").appendChild(b);
  }
  syncControls();

  $("year").textContent = new Date().getFullYear();
  $("search").addEventListener("submit", (e) => { e.preventDefault(); $("q").blur(); apply(true); });
  // Búsqueda en vivo mientras se escribe
  let typing;
  $("q").addEventListener("input", () => { clearTimeout(typing); typing = setTimeout(() => apply(false), 250); });
  $("region").addEventListener("change", () => apply(true));
  $("shift").addEventListener("change", () => apply(false));
  $("fecha").addEventListener("change", () => apply(false));
  $("sort").addEventListener("change", () => apply(false));
  $("more").addEventListener("click", () => render(false));
  $("nav-saved").addEventListener("click", toggleSavedView);
  $("bn-saved").addEventListener("click", toggleSavedView);
  $("bn-search").addEventListener("click", focusSearch);
  // "/" enfoca el buscador
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/input|select|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); focusSearch(); }
  });
  if (params.get("buscar") === "1") setTimeout(focusSearch, 300);

  $("share-site").addEventListener("click", () => {
    const text = "Ofertas de trabajo en minería de todo Chile, sin registro: https://trabajaenmineria.cl";
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
  });
  $("share-site-li").addEventListener("click", () => shareLinkedIn(siteLink("")));

  // Video "Cómo funciona"
  $("play").addEventListener("click", () => {
    const v = $("video");
    $("player").classList.add("playing");
    v.controls = true;
    v.play().catch(() => {});
  });

  // Carga continua: al llegar al final de la lista se cargan más ofertas solas
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !$("more").hidden) render(false);
    }, { rootMargin: "400px" }).observe($("more"));
  }
  // Botón volver arriba
  window.addEventListener("scroll", () => { $("to-top").hidden = window.scrollY < 1200; }, { passive: true });
  $("to-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  updateSavedCount();
  $("jobs").innerHTML = '<li class="skeleton"></li>'.repeat(4);

  fetch((window.TEM_CONFIG || {}).jobsUrl || "data/jobs.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((data) => {
      all = (data.jobs || []).map((j, i) => ({
        ...j,
        _id: j.url || String(i),
        _hay: norm([j.title, j.company, j.location, j.description].join(" ")),
        _shift: ((`${j.title} ${j.description}`.match(SHIFT_RE) || [])[0] || "").toLowerCase(),
      }));
      $("stat-jobs").textContent = all.length.toLocaleString("es-CL");
      $("stat-new").textContent = all.filter((j) => j.date && Date.now() - new Date(j.date) < 864e5).length.toLocaleString("es-CL");
      if (data.updated) {
        $("updated").textContent = "Actualizado " + new Date(data.updated).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
      }
      renderRegionLinks();
      renderSources();
      apply(false);
    })
    .catch(() => { $("count").textContent = "No se pudieron cargar las ofertas."; $("jobs").innerHTML = ""; });

  function filters() {
    return { q: $("q").value.trim(), region: $("region").value, shift: $("shift").value, days: $("fecha").value, cat: category, saved: onlySaved };
  }

  function matches(j, f, skip) {
    const terms = norm(f.q).split(/\s+/).filter(Boolean);
    if (f.saved && !saved.has(j._id)) return false;
    if (terms.some((t) => !j._hay.includes(t))) return false;
    if (skip !== "region" && f.region && j.region !== f.region) return false;
    if (f.shift && j._shift !== f.shift) return false;
    // Publicada: hoy = últimas 24 h; 7 y 30 días
    if (f.days && (!j.date || Date.now() - new Date(j.date) > Number(f.days) * 864e5)) return false;
    if (f.cat && !j._hay.includes(norm(f.cat).slice(0, 6))) return false;
    return true;
  }

  function apply(scroll) {
    const f = filters();
    filtered = all.filter((j) => matches(j, f));
    if ($("sort").value === "az") filtered.sort((a, b) => a.title.localeCompare(b.title, "es"));
    else filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const url = new URL(location);
    ["q", "region", "cat", "turno", "fecha", "guardados", "buscar"].forEach((k) => url.searchParams.delete(k));
    if (f.days) url.searchParams.set("fecha", f.days);
    if (f.q) url.searchParams.set("q", f.q);
    if (f.region) url.searchParams.set("region", f.region);
    if (f.cat) url.searchParams.set("cat", f.cat);
    if (f.shift) url.searchParams.set("turno", f.shift);
    if (f.saved) url.searchParams.set("guardados", "1");
    history.replaceState(null, "", url);

    syncControls();
    renderActiveFilters(f);
    render(true);
    if (scroll) $("ofertas").scrollIntoView({ block: "start" });
  }

  // Pastillas con cada filtro activo; la "x" quita solo ese filtro
  function renderActiveFilters(f) {
    const pills = [];
    if (f.q) pills.push(["q", `“${f.q}”`]);
    if (f.region) pills.push(["region", f.region]);
    if (f.cat) pills.push(["cat", f.cat]);
    if (f.shift) pills.push(["shift", "Turno " + f.shift]);
    if (f.days) pills.push(["days", f.days === "1" ? "Publicadas hoy" : `Últimos ${f.days} días`]);
    if (f.saved) pills.push(["saved", "Guardadas"]);
    const box = $("active-filters");
    box.innerHTML = pills.map(([k, label]) =>
      `<button type="button" class="pill" data-k="${k}" aria-label="Quitar filtro ${esc(label)}">${esc(label)}<span aria-hidden="true">×</span></button>`).join("") +
      (pills.length > 1 ? '<button type="button" class="link-btn" data-k="all">Limpiar todo</button>' : "");
    box.querySelectorAll("[data-k]").forEach((b) => { b.onclick = () => clearFilter(b.dataset.k); });
  }

  function clearFilter(k) {
    if (k === "q" || k === "all") $("q").value = "";
    if (k === "region" || k === "all") $("region").value = "";
    if (k === "shift" || k === "all") $("shift").value = "";
    if (k === "days" || k === "all") $("fecha").value = "";
    if (k === "cat" || k === "all") setCategory("");
    if (k === "saved" || k === "all") onlySaved = false;
    apply(false);
  }

  function setCategory(c) { category = c; }
  function syncControls() {
    [...$("chips").children].forEach((x) => x.setAttribute("aria-pressed", String(x.textContent === category)));
    $("nav-saved").setAttribute("aria-pressed", String(onlySaved));
    $("bn-saved").classList.toggle("active", onlySaved);
  }

  function toggleSavedView() {
    onlySaved = !onlySaved;
    apply(true);
  }

  function focusSearch() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => $("q").focus({ preventScroll: true }), 250);
  }

  function render(reset) {
    const list = $("jobs");
    if (reset) { list.innerHTML = ""; shown = 0; }
    const n = filtered.length;
    const label = onlySaved ? "guardada" : "oferta";
    $("count").textContent = n === 1 ? `1 ${label}` : `${n.toLocaleString("es-CL")} ${label}s`;

    if (!n) {
      list.innerHTML = "";
      list.appendChild(emptyState());
      $("more").hidden = true;
      return;
    }

    const terms = norm($("q").value).split(/\s+/).filter((t) => t.length > 1);
    const slice = filtered.slice(shown, shown + PAGE);
    slice.forEach((j, i) => {
      list.appendChild(jobItem(j, terms));
      if ((shown + i + 1) % AD_EVERY === 0 && ads.enabled) list.appendChild(adItem());
    });
    shown += slice.length;
    $("more").hidden = shown >= n;
  }

  // Estados vacíos que dicen qué hacer a continuación
  function emptyState() {
    const li = document.createElement("li");
    li.className = "empty";
    const f = filters();
    if (onlySaved) {
      li.innerHTML = '<b>Aún no guardas ofertas</b>Toca el marcador de una oferta para tenerla a mano después.<div class="empty-actions"><button type="button" class="btn btn-sm" data-do="saved">Ver todas las ofertas</button></div>';
    } else if (!all.length) {
      li.innerHTML = '<b>Estamos cargando las primeras ofertas</b>La búsqueda automática corre cada 2 horas. Mientras tanto, deja tu CV listo para postular al tiro.<div class="empty-actions"><a class="btn btn-sm" href="cv.html">Preparar mi CV</a></div>';
    } else {
      // ¿Hay resultados para la misma búsqueda en otra región?
      const elsewhere = {};
      if (f.region) all.forEach((j) => { if (j.region && matches(j, f, "region")) elsewhere[j.region] = (elsewhere[j.region] || 0) + 1; });
      const top = Object.entries(elsewhere).sort((a, b) => b[1] - a[1]).slice(0, 3);
      li.innerHTML = '<b>No encontramos ofertas con esos filtros</b>Prueba con otras palabras o quita algún filtro.' +
        '<div class="empty-actions"><button type="button" class="btn btn-sm" data-do="all">Quitar filtros</button>' +
        top.map(([r, c]) => `<button type="button" class="pill" data-region="${esc(r)}">${esc(r)} · ${c}</button>`).join("") + "</div>";
    }
    li.querySelectorAll("[data-do]").forEach((b) => { b.onclick = () => clearFilter(b.dataset.do); });
    li.querySelectorAll("[data-region]").forEach((b) => { b.onclick = () => { $("region").value = b.dataset.region; apply(false); }; });
    return li;
  }

  function jobItem(j, terms) {
    const li = document.createElement("li");
    li.className = "job";
    const d = j.date ? new Date(j.date) : null;
    const isNew = d && Date.now() - d < NEW_HOURS * 36e5;
    const initial = (j.company || j.title || "?").trim().charAt(0).toUpperCase();
    const isSaved = saved.has(j._id);
    li.innerHTML = `
      <div class="avatar" aria-hidden="true">${esc(initial)}</div>
      <h3>${j.page
        ? `<a href="${esc(j.page)}">${highlight(j.title, terms)}</a>`
        : `<a href="${safeUrl(j.url)}" target="_blank" rel="noopener nofollow sponsored">${highlight(j.title, terms)}</a>`}</h3>
      <div class="actions">
        <button type="button" class="icon-btn" data-act="save" aria-pressed="${isSaved}" aria-label="${isSaved ? "Quitar de guardados" : "Guardar oferta"}">${isSaved ? ICON.saved : ICON.save}</button>
        <button type="button" class="icon-btn" data-act="linkedin" aria-label="Compartir en LinkedIn">${ICON.linkedin}</button>
        <button type="button" class="icon-btn" data-act="share" aria-label="Compartir oferta">${ICON.share}</button>
      </div>
      <div class="meta">
        ${j.company ? `<span>${ICON.company}${highlight(j.company, terms)}</span>` : ""}
        ${j.location ? `<span>${ICON.pin}${esc(j.location)}</span>` : ""}
        ${j.salary ? `<span class="salary">${ICON.money}${esc(j.salary)}</span>` : ""}
      </div>
      ${j.description ? `<p class="desc">${esc(j.description.slice(0, 200))}${j.description.length > 200 ? "…" : ""}</p>` : ""}
      <div class="tags">
        ${isNew ? '<span class="tag tag-new">Nuevo</span>' : ""}
        ${j.cargo ? (j.cargo.page
          ? `<a class="tag tag-cargo" href="/empleos/${esc(j.cargo.slug)}" title="Ver más ofertas de este cargo">Se busca: ${esc(j.cargo.name)}</a>`
          : `<span class="tag tag-cargo">Se busca: ${esc(j.cargo.name)}</span>`) : ""}
        ${j._shift ? `<button type="button" class="tag tag-shift" data-shift="${esc(j._shift)}" title="Ver solo turno ${esc(j._shift)}">Turno ${esc(j._shift)}</button>` : ""}
        ${j.region ? `<span class="tag">${esc(j.region)}</span>` : ""}
        <span>${esc(j.source || "")} ${d ? "· " + timeAgo(d) : ""}</span>
      </div>
      <div class="apply-row"><a class="btn" href="${safeUrl(j.url)}" target="_blank" rel="noopener nofollow sponsored">Postular</a></div>
      <a class="mirrow-chip" data-mirrow="tarjeta" data-empresa="${esc(j.company || "")}" href="${esc((window.temMirrowUrl || (() => "https://www.mirrow.cl"))("tarjeta"))}" target="_blank" rel="noopener sponsored">
        <img src="/media/mirrow-logo.png" width="22" height="21" alt="">
        <span>${j.company && !/confidencial|reservad/i.test(j.company) ? `¿Conoces <b>${esc(j.company)}</b>? Revísala en Mirrow` : "Antes de postular, revisa la empresa en Mirrow"}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>`;

    // Estadísticas (Google Analytics): cuántos postulan, guardan y comparten, por empresa y fuente
    const info = { empresa: j.company || "", fuente: j.source || "", region: j.region || "" };
    li.querySelectorAll(j.page ? '.apply-row a' : '.apply-row a, h3 a').forEach((a) => a.addEventListener("click", () => track("postular", info)));
    li.querySelector('[data-act="save"]').onclick = (e) => { toggleSave(j, e.currentTarget); track("guardar_oferta", info); };
    li.querySelector('[data-act="share"]').onclick = () => { share(j); track("compartir_oferta", info); };
    li.querySelector('[data-act="linkedin"]').onclick = () => { shareLinkedIn(j.page ? location.origin + j.page : siteLink(j.title)); track("compartir_linkedin", info); };
    const st = li.querySelector("[data-shift]");
    if (st) st.onclick = () => { $("shift").value = st.dataset.shift; apply(true); };
    return li;
  }

  // Resalta los términos buscados (sin importar tildes ni mayúsculas)
  function highlight(text, terms) {
    text = String(text || "");
    if (!terms || !terms.length) return esc(text);
    let flat = "", map = [];
    for (let i = 0; i < text.length; i++) { const n = norm(text[i]); for (const ch of n) { flat += ch; map.push(i); } }
    const marks = new Array(text.length).fill(false);
    for (const t of terms) {
      let from = 0, at;
      while ((at = flat.indexOf(t, from)) !== -1) {
        for (let k = at; k < at + t.length; k++) marks[map[k]] = true;
        from = at + t.length;
      }
    }
    let out = "", open = false;
    for (let i = 0; i < text.length; i++) {
      if (marks[i] && !open) { out += "<mark>"; open = true; }
      if (!marks[i] && open) { out += "</mark>"; open = false; }
      out += esc(text[i]);
    }
    return out + (open ? "</mark>" : "");
  }

  function toggleSave(j, btn) {
    if (saved.has(j._id)) saved.delete(j._id); else saved.add(j._id);
    const on = saved.has(j._id);
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "Quitar de guardados" : "Guardar oferta");
    btn.innerHTML = on ? ICON.saved : ICON.save;
    writeSaved();
    updateSavedCount();
    toast(on ? "Oferta guardada" : "Oferta quitada de guardados");
    if (onlySaved && !on) apply(false);
  }

  function share(j) {
    const text = `${j.title}${j.company ? " – " + j.company : ""}${j.location ? " (" + j.location + ")" : ""}`;
    const url = j.page ? location.origin + j.page : j.url; // la página de la oferta en este sitio, si existe
    if (navigator.share) {
      navigator.share({ title: j.title, text, url }).catch(() => {});
    } else {
      window.open("https://wa.me/?text=" + encodeURIComponent(`${text}\n${url}\nVía trabajaenmineria.cl`), "_blank", "noopener");
    }
  }

  // LinkedIn solo permite compartir un enlace: se comparte la búsqueda de la oferta en este sitio
  function siteLink(q) {
    const u = new URL(location.origin + location.pathname);
    if (q) u.searchParams.set("q", q);
    return u.href;
  }
  function shareLinkedIn(url) {
    window.open("https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url), "_blank", "noopener,width=600,height=640");
  }

  // Sección "Cada oferta viene de una fuente real": cuántas ofertas trae cada fuente
  function renderSources() {
    const box = $("sources-list");
    if (!box) return;
    const by = {};
    all.forEach((j) => { if (j.source) by[j.source] = (by[j.source] || 0) + 1; });
    box.innerHTML = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([s, n]) =>
      `<li><b>${esc(s)}</b><span>${n.toLocaleString("es-CL")} oferta${n === 1 ? "" : "s"}</span></li>`).join("");
    $("src-jobs").textContent = all.length.toLocaleString("es-CL");
    $("src-regions").textContent = new Set(all.map((j) => j.region).filter(Boolean)).size;
    $("src-week").textContent = all.filter((j) => j.date && Date.now() - new Date(j.date) < 7 * 864e5).length.toLocaleString("es-CL");
  }

  function renderRegionLinks() {
    const counts = {};
    all.forEach((j) => { if (j.region) counts[j.region] = (counts[j.region] || 0) + 1; });
    // Con páginas generadas (sitio publicado) enlaza a /empleos/<region>; si no, filtra aquí mismo
    const pages = all.some((j) => j.page);
    const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    $("region-links").innerHTML = REGIONS.filter((r) => !pages || (counts[r] || 0) >= 3).map((r) =>
      `<li><a href="${pages ? "/empleos/" + slug(r) : "?region=" + encodeURIComponent(r)}">Empleos en ${esc(r)} <small>${counts[r] || ""}</small></a></li>`).join("") +
      (pages ? '<li><a href="/empleos/">Todas las regiones y cargos <small>›</small></a></li>' : "");
  }

  // Anuncio entre ofertas: espacio propio con el tamaño de una oferta y la etiqueta "Publicidad"
  function adItem() {
    const li = document.createElement("li");
    li.className = "ad-slot ad-feed";
    li.dataset.slot = "listado";
    li.dataset.format = "fluid";
    li.innerHTML = '<span class="ad-label">Publicidad</span><div class="ad-box" data-size="Anuncio entre ofertas"></div>';
    queueMicrotask(() => ads.fill(li));
    return li;
  }

  // localStorage puede fallar (modo privado): los guardados quedan solo en memoria
  function readSaved() { try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch (e) { return []; } }
  function writeSaved() { try { localStorage.setItem(SAVED_KEY, JSON.stringify([...saved])); } catch (e) { /* sin almacenamiento */ } }
  function updateSavedCount() {
    $("saved-count").textContent = saved.size;
    $("bn-saved-count").textContent = saved.size;
    $("bn-saved-count").hidden = !saved.size;
  }

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  function timeAgo(d) {
    const h = Math.floor((Date.now() - d) / 36e5);
    if (isNaN(h)) return "";
    if (h < 1) return "hace minutos";
    if (h < 24) return `hace ${h} h`;
    const days = Math.floor(h / 24);
    return days === 1 ? "ayer" : `hace ${days} días`;
  }
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function safeUrl(u) {
    return /^https?:\/\//i.test(u || "") ? esc(u) : "#";
  }
})();
