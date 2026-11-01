// Creador y analizador de CV. El CV vive solo en este navegador (localStorage);
// la IA se usa a través de la API (función de Netlify o Worker de Cloudflare), que no guarda nada.
(function () {
  // Dónde responde la IA: se define en config.js. Vacío = sitio sin IA (por ejemplo, Netlify Drop sin Worker).
  const cfg = window.TEM_CONFIG || {};
  const API_URL = cfg.cvApiUrl === undefined ? "/api/cv" : cfg.cvApiUrl;
  const NO_AI_MSG = "La mejora con IA no está disponible en este momento. Puedes crear tu CV aquí y descargarlo en Word o PDF.";
  const STORE_KEY = "tem:cv";
  const IDEAS = ["Licencia A4 / clase D", "Liderazgo de equipos", "Seguridad y cero accidentes", "Turnos 7x7 / 4x3",
                 "Operación de CAEX", "Mantención predictiva", "Altura geográfica", "Inglés técnico"];

  // Datos personales: se quedan en el navegador, nunca se envían a la IA
  const PERSONAL_KEYS = ["nombre", "rut", "email", "telefono", "ciudad", "linkedin"];

  const $ = (id) => document.getElementById(id);
  const empty = () => ({ nombre: "", rut: "", titular: "", email: "", telefono: "", ciudad: "", linkedin: "", perfil: "",
    experiencia: [], educacion: [], certificaciones: [], habilidades: [], disponibilidad: "" });
  const newExp = () => ({ cargo: "", empresa: "", lugar: "", inicio: "", fin: "", logros: [] });
  const newEdu = () => ({ titulo: "", institucion: "", inicio: "", fin: "" });

  let cv = load();
  let tab = "crear";

  // ---------- Pestañas ----------
  function setTab(name) {
    tab = name;
    document.body.dataset.tab = name;
    $("tab-crear").setAttribute("aria-selected", String(name === "crear"));
    $("tab-mejorar").setAttribute("aria-selected", String(name === "mejorar"));
    $("panel-crear").hidden = name !== "crear";
    $("panel-mejorar").hidden = name !== "mejorar";
    $("ai-title").textContent = name === "crear" ? "Pulir con IA" : "2. ¿A qué cargo postulas?";
    $("ai-run-label").textContent = name === "crear" ? "Mejorar mi CV con IA" : "Analizar y mejorar mi CV";
  }
  $("tab-crear").onclick = () => setTab("crear");
  $("tab-mejorar").onclick = () => setTab("mejorar");
  $("go-edit").onclick = () => { setTab("crear"); $("panel-crear").scrollIntoView({ behavior: "smooth" }); };
  setTab(location.hash === "#mejorar" ? "mejorar" : "crear");

  // ---------- Formulario ----------
  document.querySelectorAll("[data-k]").forEach((el) => {
    el.addEventListener("input", () => {
      cv[el.dataset.k] = el.hasAttribute("data-lines") ? lines(el.value) : el.value;
      changed();
    });
  });
  document.querySelectorAll("[data-add]").forEach((b) => {
    b.onclick = () => { const k = b.dataset.add; cv[k].push(k === "experiencia" ? newExp() : newEdu()); renderLists(); changed(); };
  });
  $("clear-cv").onclick = () => {
    if (!confirm("¿Borrar todos los datos de tu CV de este navegador?")) return;
    cv = empty(); fillForm(); changed(); toast("CV borrado");
  };

  function fillForm() {
    document.querySelectorAll("[data-k]").forEach((el) => {
      const v = cv[el.dataset.k];
      el.value = Array.isArray(v) ? v.join("\n") : v || "";
    });
    renderLists();
  }

  const EXP_FIELDS = [["cargo", "Cargo"], ["empresa", "Empresa"], ["lugar", "Faena / ciudad"], ["inicio", "Desde (ej. mar 2019)"], ["fin", "Hasta (o Actual)"]];
  const EDU_FIELDS = [["titulo", "Título o carrera"], ["institucion", "Institución"], ["inicio", "Desde"], ["fin", "Hasta"]];
  function renderLists() {
    renderList("experiencia", EXP_FIELDS, true);
    renderList("educacion", EDU_FIELDS, false);
  }
  function renderList(key, fields, withLogros) {
    const box = $("list-" + key);
    box.innerHTML = "";
    if (!cv[key].length) { box.innerHTML = `<p class="hint">Aún no agregas ${key === "experiencia" ? "experiencia" : "estudios"}.</p>`; return; }
    cv[key].forEach((item, i) => {
      const card = document.createElement("div");
      card.className = "repeat-item";
      card.innerHTML = `<div class="grid2">${fields.map(([f, label]) =>
        `<label class="fld">${label}<input data-f="${f}" value="${esc(item[f])}"></label>`).join("")}</div>` +
        (withLogros ? `<label class="fld">Funciones y logros <small>(uno por línea)</small><textarea data-f="logros" rows="3">${esc((item.logros || []).join("\n"))}</textarea></label>` : "") +
        `<button type="button" class="link-btn danger" data-del>Quitar</button>`;
      card.querySelectorAll("[data-f]").forEach((el) => {
        el.addEventListener("input", () => { item[el.dataset.f] = el.dataset.f === "logros" ? lines(el.value) : el.value; changed(); });
      });
      card.querySelector("[data-del]").onclick = () => { cv[key].splice(i, 1); renderLists(); changed(); };
      box.appendChild(card);
    });
  }

  // ---------- Vista previa ----------
  function renderPaper() {
    const c = cv, has = (a) => a && a.length;
    const contact = [c.ciudad, c.telefono, c.email, c.rut && "RUT " + c.rut, c.linkedin].filter(Boolean).map(mark).join("  ·  ");
    const blank = !c.nombre && !c.perfil && !has(c.experiencia);
    $("cv-paper").innerHTML = blank
      ? `<div class="paper-empty"><b>Tu CV aparecerá aquí</b>Completa tus datos o sube tu CV en “Mejorar mi CV con IA”.</div>`
      : `<header><h1>${esc(c.nombre) || "<mark>[Nombre completo]</mark>"}</h1>${c.titular ? `<p class="p-title">${esc(c.titular)}</p>` : ""}${contact ? `<p class="p-contact">${contact}</p>` : ""}</header>
        ${c.perfil ? sec("Perfil profesional", `<p>${mark(c.perfil)}</p>`) : ""}
        ${has(c.experiencia) ? sec("Experiencia laboral", c.experiencia.map((e) => `
          <div class="p-item"><div class="p-row"><b>${mark(e.cargo)}</b><span>${mark([e.inicio, e.fin].filter(Boolean).join(" – "))}</span></div>
          <div class="p-sub">${mark([e.empresa, e.lugar].filter(Boolean).join(" · "))}</div>
          ${has(e.logros) ? `<ul>${e.logros.map((l) => `<li>${mark(l)}</li>`).join("")}</ul>` : ""}</div>`).join("")) : ""}
        ${has(c.educacion) ? sec("Estudios", c.educacion.map((e) => `
          <div class="p-item"><div class="p-row"><b>${esc(e.titulo)}</b><span>${esc([e.inicio, e.fin].filter(Boolean).join(" – "))}</span></div>
          <div class="p-sub">${esc(e.institucion)}</div></div>`).join("")) : ""}
        ${has(c.certificaciones) ? sec("Licencias, cursos y certificaciones", `<ul>${c.certificaciones.map((l) => `<li>${mark(l)}</li>`).join("")}</ul>`) : ""}
        ${has(c.habilidades) ? sec("Habilidades", `<p class="p-skills">${c.habilidades.map(mark).join("  ·  ")}</p>`) : ""}
        ${c.disponibilidad ? sec("Disponibilidad", `<p>${mark(c.disponibilidad)}</p>`) : ""}`;
  }
  const sec = (title, body) => `<section><h2>${title}</h2>${body}</section>`;
  // Resalta los [completar] y datos omitidos que el postulante debe llenar
  const mark = (s) => esc(s).replace(/\[(completar|nombre|correo|tel[ée]fono|RUT|direcci[óo]n|linkedin|dato personal omitido)\]/gi, "<mark>$&</mark>");

  function changed() { renderPaper(); save(); renderProgress(); }

  // ---------- Avance del CV: cuánto falta y qué conviene completar primero ----------
  function renderProgress() {
    const c = cv, has = (a) => a && a.length;
    const checks = [
      [c.nombre, "Escribe tu nombre completo."],
      [c.titular, "Agrega el cargo al que apuntas en “Cargo / titular”."],
      [c.telefono || c.email, "Agrega un teléfono o correo para que te contacten."],
      [(c.perfil || "").length >= 80, "Escribe un perfil de al menos 2 líneas: años de experiencia, especialidad y faenas."],
      [c.experiencia.some((e) => e.cargo && e.empresa), "Agrega una experiencia con cargo y empresa."],
      [c.experiencia.some((e) => has(e.logros)), "Suma funciones o logros a tu experiencia (uno por línea)."],
      [has(c.educacion), "Agrega tus estudios."],
      [has(c.certificaciones), "Agrega licencias o cursos (clase D, altura física, primeros auxilios…)."],
      [(c.habilidades || []).length >= 3, "Suma al menos 3 habilidades."],
      [c.disponibilidad, "Indica tu disponibilidad de turnos y traslado."],
    ];
    const done = checks.filter(([ok]) => ok).length;
    const pct = Math.round(done / checks.length * 100);
    const next = checks.find(([ok]) => !ok);
    $("progress-label").textContent = `Tu CV está al ${pct} %`;
    $("progress-fill").style.width = pct + "%";
    $("progress-bar").setAttribute("aria-valuenow", pct);
    $("progress-tip").textContent = next ? "Siguiente paso: " + next[1] : "¡Tu CV está completo! Descárgalo en Word o PDF.";
    $("progress-tip").classList.toggle("done", !next);
  }

  // ---------- Celular: botón para saltar entre el formulario y la vista previa ----------
  let previewVisible = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      previewVisible = entries[0].isIntersecting;
      $("fab-label").textContent = previewVisible ? "Volver a editar" : "Ver mi CV";
    }, { threshold: 0.25 }).observe($("cv-paper"));
  }
  $("fab-preview").onclick = () => {
    (previewVisible ? document.querySelector(".cv-tools") : $("cv-paper")).scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---------- IA ----------
  IDEAS.forEach((idea) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = "+ " + idea;
    b.onclick = () => {
      const t = $("ai-destacar");
      t.value = (t.value.trim() ? t.value.trim() + ", " : "") + idea.toLowerCase();
      t.focus();
    };
    $("ai-chips").appendChild(b);
  });

  $("ai-run").onclick = async () => {
    // Todo lo que se envía pasa por el filtro de privacidad; los nombres conocidos también se quitan
    const filt = { names: [cv.nombre] };
    const payload = {
      cargo: PrivacyFilter.redact($("ai-cargo").value.trim(), filt).text,
      destacar: PrivacyFilter.redact($("ai-destacar").value.trim(), filt).text,
      tono: $("ai-tono").value,
    };
    if (tab === "mejorar") {
      const text = $("cv-text").value.trim();
      if (!text) { status("Primero sube tu CV o pega su texto.", "err"); return; }
      payload.cvText = applyFilterToTextarea().text;
    } else {
      if (!cv.perfil && !cv.experiencia.length) { status("Completa al menos tu perfil o una experiencia para que la IA pueda mejorarlo.", "err"); return; }
      const professional = Object.assign({}, cv);
      PERSONAL_KEYS.forEach((k) => delete professional[k]);
      payload.cv = PrivacyFilter.redactDeep(professional, filt);
    }
    const api = window.CV_API_URL || API_URL; // window.CV_API_URL permite apuntar a otro Worker (pruebas)
    if (!api) { status(NO_AI_MSG, "err"); return; }

    const btn = $("ai-run");
    btn.disabled = true; btn.classList.add("loading");
    status("Analizando tu CV… puede tardar hasta un minuto.", "");
    try {
      const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await r.json().catch(() => ({}));
      // 404/405 sin JSON: el sitio está publicado sin la función de IA (por ejemplo, en GitHub Pages)
      if ((r.status === 404 || r.status === 405) && !data.error) throw new Error("La IA aún no está configurada en este sitio.");
      if (r.status === 504) throw new Error("La IA tardó demasiado. Inténtalo de nuevo o acorta tu CV.");
      if (!r.ok) throw new Error(data.error || "No pudimos procesar tu CV. Inténtalo de nuevo.");
      showResult(data);
      // La IA no recibe ni devuelve datos personales: se conservan los que la persona escribió aquí
      const personal = {};
      PERSONAL_KEYS.forEach((k) => (personal[k] = cv[k] || ""));
      cv = Object.assign(empty(), data.cv, personal);
      fillForm(); changed();
      $("word-hint").hidden = false;
      status("¡Listo! Revisa tu CV mejorado y descárgalo en Word para agregar tus datos personales.", "ok");
      $("result").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      status(e.message === "Failed to fetch" ? "No hay conexión con el servicio. Inténtalo de nuevo." : e.message, "err");
    } finally {
      btn.disabled = false; btn.classList.remove("loading");
    }
  };

  function showResult(d) {
    $("result").hidden = false;
    const n = Math.max(0, Math.min(100, Math.round(d.puntaje || 0)));
    $("score").style.setProperty("--v", n);
    $("score-n").textContent = n;
    $("r-diag").textContent = d.diagnostico || "";
    $("r-fort").innerHTML = (d.fortalezas || []).map((x) => `<li>${esc(x)}</li>`).join("");
    $("r-brechas").innerHTML = (d.brechas || []).map((x) => `<li>${esc(x)}</li>`).join("");
    $("r-kw").innerHTML = (d.palabras_clave_faltantes || []).map((x) => `<span class="kw">${esc(x)}</span>`).join("");
    const pend = d.pendientes || [];
    $("r-pend-box").hidden = !pend.length;
    $("r-pend").innerHTML = pend.map((x) => `<li>${esc(x)}</li>`).join("");
  }

  function status(msg, kind) {
    const s = $("ai-status");
    s.textContent = msg;
    s.className = "ai-status" + (kind ? " " + kind : "");
  }

  // ---------- Subir archivo ----------
  const drop = $("drop");
  $("file").addEventListener("change", (e) => e.target.files[0] && readFile(e.target.files[0]));
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]));

  async function readFile(file) {
    $("drop-title").textContent = "Leyendo " + file.name + "…";
    try {
      let text = "";
      const name = file.name.toLowerCase();
      if (name.endsWith(".pdf")) text = await pdfText(file);
      else if (name.endsWith(".docx")) text = await docxText(file);
      else text = await file.text();
      text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      if (text.length < 40) throw new Error("No encontramos texto en el archivo. Si es un PDF escaneado, pega el texto manualmente.");
      $("cv-text").value = text;
      text = applyFilterToTextarea().text;
      $("cv-text").closest("details").open = true;
      drop.classList.add("done");
      $("drop-title").textContent = "✓ " + file.name;
      $("drop-sub").textContent = `${text.length.toLocaleString("es-CL")} caracteres leídos. Puedes revisarlos abajo.`;
    } catch (e) {
      drop.classList.remove("done");
      $("drop-title").textContent = "No pudimos leer el archivo";
      $("drop-sub").textContent = e.message || "Prueba con otro formato o pega el texto.";
    }
  }
  // Quita los datos personales del texto del CV apenas se carga o se pega, y avisa qué se quitó
  function applyFilterToTextarea() {
    const ta = $("cv-text");
    const r = PrivacyFilter.redact(ta.value, { guessName: true, names: [cv.nombre] });
    ta.value = r.text;
    const box = $("redacted");
    box.hidden = false;
    box.textContent = r.found.length
      ? `🔒 Quitamos de tu CV: ${r.found.join(", ")}. Estos datos no se procesan por privacidad; los agregarás en el Word.`
      : "🔒 No encontramos datos personales en el texto. Si quedó alguno, bórralo antes de continuar.";
    return r;
  }
  $("cv-text").addEventListener("change", () => $("cv-text").value.trim() && applyFilterToTextarea());

  function loadScript(src) {
    return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => ko(new Error("No se pudo cargar el lector de archivos.")); document.head.appendChild(s); });
  }
  async function pdfText(file) {
    const base = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
    if (!window.pdfjsLib) await loadScript(base + "pdf.min.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 8); i++) {
      const content = await (await pdf.getPage(i)).getTextContent();
      let line = "", out = [], lastY = null;
      for (const it of content.items) {
        const y = it.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 2) { out.push(line); line = ""; }
        line += it.str; lastY = y;
      }
      out.push(line);
      pages.push(out.join("\n"));
    }
    return pages.join("\n\n");
  }
  async function docxText(file) {
    if (!window.mammoth) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  }

  // ---------- Descargar en Word (.docx) ----------
  // Se arma en el navegador con JSZip. Los datos personales que falten quedan como campos resaltados en amarillo.
  $("word-cv").onclick = async () => {
    try {
      if (!window.JSZip) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
      const blob = await buildDocx(cv);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "CV-" + (cv.nombre ? cv.nombre.trim().replace(/\s+/g, "-") : "mejorado") + ".docx";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast("Word descargado");
    } catch (e) { toast("No se pudo generar el Word"); }
  };

  function buildDocx(c) {
    const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // Un texto se parte en tramos; lo que está entre [corchetes] va resaltado para completar a mano
    const runs = (text, rpr = "") => String(text || "").split(/(\[[^\]]+\])/).filter(Boolean).map((t) =>
      `<w:r><w:rPr>${rpr}${/^\[.*\]$/.test(t) ? '<w:highlight w:val="yellow"/>' : ""}</w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`).join("");
    const para = (inner, ppr = "") => `<w:p><w:pPr>${ppr}</w:pPr>${inner}</w:p>`;
    const space = (after, before = 0) => `<w:spacing w:before="${before}" w:after="${after}"/>`;
    const heading = (t) => para(runs(t.toUpperCase(), '<w:b/><w:color w:val="A85A22"/><w:sz w:val="20"/>'),
      `${space(80, 220)}<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="D98A3D"/></w:pBdr>`);
    const bullet = (t) => para(runs("•  ") + runs(t), `${space(40)}<w:ind w:left="300" w:hanging="200"/>`);
    const tabRun = '<w:r><w:tab/></w:r>';
    const rightTab = '<w:tabs><w:tab w:val="right" w:pos="9900"/></w:tabs>';
    const ph = (v, label) => (v && v.trim() ? v : `[${label}]`);

    const body = [];
    body.push(para(runs(ph(c.nombre, "Nombre completo"), '<w:b/><w:sz w:val="40"/><w:color w:val="12171D"/>'), space(40)));
    if (c.titular) body.push(para(runs(c.titular, '<w:b/><w:color w:val="A85A22"/><w:sz w:val="24"/>'), space(60)));
    const contact = [ph(c.telefono, "Teléfono"), ph(c.email, "Correo"), ph(c.ciudad, "Dirección o ciudad"), "RUT " + ph(c.rut, "RUT")];
    if (c.linkedin) contact.push(c.linkedin);
    body.push(para(runs(contact.join("   ·   "), '<w:color w:val="5A636D"/><w:sz w:val="19"/>'),
      `${space(120)}<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="6" w:color="D98A3D"/></w:pBdr>`));

    if (c.perfil) { body.push(heading("Perfil profesional")); body.push(para(runs(c.perfil), space(60))); }
    if (c.experiencia.length) {
      body.push(heading("Experiencia laboral"));
      c.experiencia.forEach((e) => {
        body.push(para(runs(e.cargo, "<w:b/>") + tabRun + runs([e.inicio, e.fin].filter(Boolean).join(" – "), '<w:color w:val="5A636D"/>'), rightTab + space(0, 100)));
        const sub = [e.empresa, e.lugar].filter(Boolean).join(" · ");
        if (sub) body.push(para(runs(sub, '<w:i/><w:color w:val="5A636D"/>'), space(40)));
        (e.logros || []).forEach((l) => body.push(bullet(l)));
      });
    }
    if (c.educacion.length) {
      body.push(heading("Estudios"));
      c.educacion.forEach((e) => {
        body.push(para(runs(e.titulo, "<w:b/>") + tabRun + runs([e.inicio, e.fin].filter(Boolean).join(" – "), '<w:color w:val="5A636D"/>'), rightTab + space(0, 80)));
        if (e.institucion) body.push(para(runs(e.institucion, '<w:i/><w:color w:val="5A636D"/>'), space(40)));
      });
    }
    if (c.certificaciones.length) { body.push(heading("Licencias, cursos y certificaciones")); c.certificaciones.forEach((l) => body.push(bullet(l))); }
    if (c.habilidades.length) { body.push(heading("Habilidades")); body.push(para(runs(c.habilidades.join("  ·  ")), space(60))); }
    if (c.disponibilidad) { body.push(heading("Disponibilidad")); body.push(para(runs(c.disponibilidad), space(60))); }

    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body.join("")}` +
      `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr>` +
      `<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:color w:val="1D2228"/><w:lang w:val="es-CL"/></w:rPr></w:rPrDefault>` +
      `<w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;

    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file("word/document.xml", doc);
    zip.file("word/styles.xml", styles);
    return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  // ---------- Descargar / copiar ----------
  $("print-cv").onclick = () => {
    const prev = document.title;
    document.title = "CV " + (cv.nombre || "trabajaenmineria");
    window.print();
    document.title = prev;
  };
  $("copy-cv").onclick = async () => {
    try { await navigator.clipboard.writeText($("cv-paper").innerText); toast("CV copiado"); }
    catch (e) { toast("No se pudo copiar"); }
  };

  // ---------- Guardado local ----------
  function load() {
    try { return Object.assign(empty(), JSON.parse(localStorage.getItem(STORE_KEY)) || {}); } catch (e) { return empty(); }
  }
  let savedTimer;
  function save() {
    const note = $("saved-note");
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(cv));
      note.textContent = "✓ Guardado en este navegador";
      note.classList.add("flash");
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => note.classList.remove("flash"), 1200);
    } catch (e) {
      // sin almacenamiento: el CV queda solo en memoria
      note.textContent = "No se puede guardar aquí: descarga tu CV antes de salir";
    }
  }

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }
  function lines(v) { return v.split("\n").map((s) => s.trim()).filter(Boolean); }
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* bloqueador o AdSense sin aprobar */ }
  if (!API_URL) status(NO_AI_MSG, "");
  fillForm();
  renderPaper();
  renderProgress();
})();
