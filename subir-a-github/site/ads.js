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

  // Pone el bloque de AdSense dentro de un .ad-slot (data-slot = nombre del espacio en config.js)
  function fill(slot) {
    if (slot.dataset.filled) return;
    slot.dataset.filled = "1";
    const id = slots[slot.dataset.slot];
    if (preview) { slot.classList.add("ad-ready"); return; }
    if (!client || !id) return;
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
  });

  // Anuncios entre ofertas solo si existe el bloque "listado" (o en la vista previa)
  window.TEM_ADS = { fill, enabled: preview || (!!client && !!slots.listado) };
})();
