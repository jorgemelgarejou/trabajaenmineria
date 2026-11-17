// Espacios de publicidad (AdSense) y banner de Mirrow, compartido por index.html y cv.html.
// Cada espacio tiene su lugar fijo en la página: si no hay anuncio, el espacio no se muestra.
(function () {
  const cfg = window.TEM_CONFIG || {};
  const slots = cfg.adSlots || {};
  const client = /^ca-pub-\d{10,}$/.test(cfg.adClient || "") ? cfg.adClient : "";
  // ?ver-anuncios muestra dónde irá cada anuncio (marcos de muestra en vez de anuncios reales)
  const preview = new URLSearchParams(location.search).has("ver-anuncios");
  const root = document.documentElement;
  root.classList.toggle("ads-on", !!client && !preview);
  root.classList.toggle("ads-preview", preview);

  // El <head> de cada página ya trae el script de AdSense (lo exige la verificación de Google)
  if (client && !preview && !document.querySelector('script[src*="adsbygoogle.js"]')) {
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + client;
    document.head.appendChild(s);
  }

  // Patrocinios vendidos directo (config.js > patrocinios). Tienen prioridad sobre AdSense en su espacio.
  // Solo se muestran los vigentes (campo "hasta") y con enlace https.
  const hoy = new Date();
  const patrocinios = (cfg.patrocinios || []).filter((p) => p && p.nombre && p.titulo && /^https:\/\//.test(p.url || "") &&
    (!p.desde || new Date(p.desde + "T00:00:00") <= hoy) && (!p.hasta || new Date(p.hasta + "T23:59:59") >= hoy));
  const turno = {};
  function patrocinioPara(espacio) {
    const lista = patrocinios.filter((p) => !p.espacios || p.espacios.indexOf(espacio) >= 0);
    if (!lista.length) return null;
    // Si hay varios para el mismo espacio, se turnan (empieza en uno al azar en cada visita)
    if (turno[espacio] === undefined) turno[espacio] = Math.floor(Math.random() * lista.length);
    return lista[turno[espacio]++ % lista.length];
  }
  function conUtm(url, espacio) {
    try {
      const u = new URL(url);
      if (!u.searchParams.has("utm_source")) {
        u.searchParams.set("utm_source", "trabajaenmineria");
        u.searchParams.set("utm_medium", "patrocinio");
        u.searchParams.set("utm_campaign", espacio);
      }
      return u.toString();
    } catch (e) { return url; }
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function tarjeta(slot, { href, logo, etiqueta, titulo, texto, cta, externo, datos }) {
    const a = el("a", "patro");
    a.href = href;
    if (externo) { a.target = "_blank"; a.rel = "noopener sponsored"; }
    Object.keys(datos).forEach((k) => { a.dataset[k] = datos[k]; });
    if (logo) {
      const img = el("img", "patro-logo");
      img.src = logo; img.alt = ""; img.loading = "lazy"; img.width = 56; img.height = 56;
      a.appendChild(img);
    }
    const t = el("span", "patro-text");
    if (etiqueta) t.appendChild(el("small", "", etiqueta));
    t.appendChild(el("b", "", titulo));
    if (texto) t.appendChild(el("span", "", texto));
    a.appendChild(t);
    a.appendChild(el("span", "patro-cta", cta));
    const label = slot.querySelector(".ad-label");
    if (label) label.textContent = externo ? "Patrocinado" : "Anúnciate aquí";
    const box = slot.querySelector(".ad-box");
    box.textContent = "";
    box.appendChild(a);
    slot.classList.add("ad-ready", externo ? "is-patro" : "is-house");
  }

  // Llena un .ad-slot (data-slot = nombre del espacio en config.js): patrocinio > AdSense > aviso "Anúnciate aquí"
  function fill(slot) {
    if (slot.dataset.filled) return;
    slot.dataset.filled = "1";
    const espacio = slot.dataset.slot;
    const id = slots[espacio];
    const p = patrocinioPara(espacio);
    if (p) {
      return tarjeta(slot, {
        href: conUtm(p.url, espacio), logo: /^(https:\/\/|\/)/.test(p.logo || "") ? p.logo : "",
        etiqueta: p.categoria || p.nombre, titulo: p.titulo, texto: p.texto || "", cta: p.cta || "Ver más", externo: true,
        datos: { patro: p.nombre, espacio },
      });
    }
    if (preview) { slot.classList.add("ad-ready"); return; }
    if (!client || !id) {
      // Espacio sin vender: aviso propio que invita a anunciar (no en el listado, para no recargar las ofertas)
      if (cfg.anunciateAqui && espacio !== "listado") {
        tarjeta(slot, {
          href: "/empresas.html#anunciar", etiqueta: "Para empresas",
          titulo: "¿Capacitas, contratas o vendes para minería?",
          texto: "Muestra tu marca a quienes buscan trabajo en minería en todo Chile.",
          cta: "Anúnciate", externo: false, datos: { anunciate: espacio },
        });
      }
      return;
    }
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.dataset.adClient = client;
    ins.dataset.adSlot = id;
    if (slot.dataset.format === "fluid" && cfg.adLayoutKey) {
      ins.dataset.adFormat = "fluid";
      ins.dataset.adLayoutKey = cfg.adLayoutKey;
    } else {
      ins.dataset.adFormat = "auto";
      ins.dataset.fullWidthResponsive = "true";
    }
    slot.querySelector(".ad-box").appendChild(ins);
    slot.classList.add("ad-ready");
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* bloqueador de anuncios */ }
  }
  document.querySelectorAll(".ad-slot").forEach(fill);

  // Mirrow: enlace con UTM por ubicación (data-mirrow="oferta", "tarjeta", "portada"…) y clic medido en Analytics
  const mirrowBase = cfg.mirrowUrl || "https://www.mirrow.cl";
  window.temMirrowUrl = function (where) {
    const sep = mirrowBase.indexOf("?") >= 0 ? "&" : "?";
    return mirrowBase + sep + "utm_source=trabajaenmineria&utm_medium=referral&utm_campaign=" + encodeURIComponent(where || "banner");
  };
  document.querySelectorAll("a[data-mirrow]").forEach((a) => { a.href = window.temMirrowUrl(a.dataset.mirrow); });
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[data-mirrow]");
    if (a && window.track) window.track("click_mirrow", { ubicacion: a.dataset.mirrow || "banner", empresa: a.dataset.empresa || "" });
    const pa = e.target.closest && e.target.closest("a.patro");
    if (pa && window.track) {
      if (pa.dataset.patro) window.track("click_patrocinio", { patrocinador: pa.dataset.patro, ubicacion: pa.dataset.espacio || "" });
      else if (pa.dataset.anunciate) window.track("click_anunciate", { ubicacion: pa.dataset.anunciate });
    }
  });

  // Anuncios entre ofertas si existe el bloque "listado", un patrocinio para ese espacio o la vista previa
  window.TEM_ADS = { fill, enabled: preview || (!!client && !!slots.listado) || patrocinios.some((p) => !p.espacios || p.espacios.indexOf("listado") >= 0) };
})();
