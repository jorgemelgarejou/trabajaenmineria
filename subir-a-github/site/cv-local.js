// Corrector de CV que funciona en el navegador, sin conexión a la IA de Claude.
// Devuelve el mismo formato que la API (/api/cv): puntaje, diagnóstico, fortalezas, brechas,
// palabras clave faltantes, pendientes y el CV reestructurado. Nunca inventa datos:
// lo que falta queda como [completar] y lo que el postulante pide agregar sin respaldo queda en "pendientes".
// Recibe el CV ya sin datos personales (ver privacy-filter.js).
(function () {
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const clean = (s) => String(s || "").replace(/^[\s•·\-–—*●▪►>✓]+/, "").replace(/[\s,;:]+$/, "").replace(/\s+/g, " ").trim();
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const uniq = (arr) => { const seen = new Set(); return arr.filter((x) => { const k = norm(x); if (!x || seen.has(k)) return false; seen.add(k); return true; }); };

  // ---------- Perfiles de cargo: palabras clave que buscan reclutadores y sistemas ATS ----------
  // El orden importa: "Operador de planta" debe caer en planta antes que en operador de equipos
  const ROLES = [
    { id: "planta", test: /planta|chancado|molienda|flotacion|concentradora|lixiviacion|sala de control|procesos/,
      titulo: "Operador de planta",
      kw: ["Chancado", "Molienda", "Flotación", "Espesadores", "Lixiviación", "Sala de control", "DCS",
           "Control de procesos", "Muestreo", "Aislamiento y bloqueo", "Turnos 7x7", "Reporte de turno"] },
    { id: "operador", test: /operador|caex|pala|cargador|bulldozer|motoniveladora|perforadora|equipo(s)? (pesado|movil)|camion/,
      titulo: "Operador de equipos mineros",
      kw: ["CAEX", "Licencia clase D", "Licencia A4 o A5", "Check list pre-uso", "Operación segura", "Turnos 7x7", "Rajo abierto",
           "Manejo defensivo", "Examen de altura geográfica", "Inducción de faena", "Reporte de incidentes", "Equipos de movimiento de tierra"] },
    { id: "mantencion", test: /mantenedor|mantencion|mantenimiento|mecanic|electromecanic|hidraulic/,
      titulo: "Mantenedor mecánico",
      kw: ["Mantención preventiva", "Mantención correctiva", "Mantención predictiva", "Sistemas hidráulicos", "Motores diésel",
           "Aislamiento y bloqueo", "Lectura de planos", "Análisis de falla", "SAP PM", "Equipos de movimiento de tierra", "Torque y alineamiento", "Turnos 7x7"] },
    { id: "electrico", test: /electric|instrument|automatiz|plc/,
      titulo: "Técnico eléctrico",
      kw: ["Media tensión", "Baja tensión", "Tableros eléctricos", "PLC", "Variadores de frecuencia", "Instrumentación",
           "Aislamiento y bloqueo", "Licencia SEC", "Lectura de planos eléctricos", "Mantención predictiva", "Termografía", "Turnos 7x7"] },
    { id: "prevencion", test: /prevenci|seguridad|hse|hsec|sso|riesgo/,
      titulo: "Prevencionista de riesgos",
      kw: ["ISO 45001", "DS 132", "Matriz IPER", "Investigación de incidentes", "Análisis de riesgos", "Auditorías de seguridad",
           "Inspecciones de terreno", "Comité paritario", "Plan de emergencia", "Capacitación en seguridad", "Indicadores de accidentabilidad", "Registro SEREMI"] },
    { id: "geologia", test: /geolog|sondaj|exploraci/,
      titulo: "Geólogo",
      kw: ["Mapeo geológico", "Logueo de sondajes", "Modelamiento geológico", "Leapfrog", "QA/QC", "Muestreo",
           "Control de leyes", "GIS", "Estimación de recursos", "Geología de mina", "Reportabilidad", "Turnos 7x7"] },
    { id: "soldador", test: /soldad|calderer|oxicorte/,
      titulo: "Soldador",
      kw: ["Soldadura SMAW", "Soldadura GMAW", "Soldadura FCAW", "Certificación AWS", "Oxicorte", "Lectura de planos",
           "Trabajo en altura", "Armado de estructuras", "Control de calidad", "Permiso de trabajo en caliente", "Turnos 7x7", "Calderería"] },
    { id: "conductor", test: /conductor|chofer|bus|transporte de personal/,
      titulo: "Conductor",
      kw: ["Licencia A2", "Licencia A4", "Licencia A5", "Manejo defensivo", "Transporte de personal", "Conducción 4x4",
           "Hoja de vida del conductor", "Check list pre-uso", "Caminos mineros", "Examen psicosensotécnico", "Turnos 7x7", "Altura geográfica"] },
    { id: "supervisor", test: /supervisor|jefe de turno|capataz|lider/,
      titulo: "Supervisor de turno",
      kw: ["Liderazgo de equipos", "Gestión de turnos", "Cumplimiento del programa", "Indicadores KPI", "Seguridad y cero daño",
           "Charlas de seguridad", "Control de costos", "Gestión de contratistas", "Reportabilidad", "Planificación diaria", "Mejora continua", "Turnos 7x7"] },
    { id: "ingenieria", test: /ingenier|planificac|proyecto|confiabilidad/,
      titulo: "Ingeniero",
      kw: ["Planificación", "MS Project", "Primavera P6", "Control de costos", "Indicadores KPI", "Gestión de contratos",
           "Confiabilidad", "Power BI", "Excel avanzado", "Mejora continua", "Gestión de proyectos", "Inglés técnico"] },
    { id: "administracion", test: /administra|asistente|contab|bodega|abastecimiento|rrhh|recursos humanos|logistic/,
      titulo: "Administrativo",
      kw: ["SAP", "Excel avanzado", "Control documental", "Gestión de contratos", "Abastecimiento", "Control de inventario",
           "Remuneraciones", "Reportabilidad", "Atención a contratistas", "Gestión de proveedores", "Power BI", "Acreditación de personal"] },
  ];
  const GENERAL_KW = ["Seguridad", "Trabajo en equipo", "Turnos 7x7", "Inducción de faena", "Examen de altura geográfica", "Mejora continua"];

  function pickRole(cargo, text) {
    const c = norm(cargo);
    return ROLES.find((r) => r.test.test(c)) || ROLES.find((r) => r.test.test(norm(text))) || null;
  }

  // ---------- Verbos: las funciones se reescriben como logros en pasado ----------
  const VERBOS = {
    operar: "Operé", realizar: "Realicé", mantener: "Mantuve", supervisar: "Supervisé", coordinar: "Coordiné", liderar: "Lideré",
    controlar: "Controlé", ejecutar: "Ejecuté", apoyar: "Apoyé", reparar: "Reparé", inspeccionar: "Inspeccioné", conducir: "Conduje",
    elaborar: "Elaboré", gestionar: "Gestioné", planificar: "Planifiqué", instalar: "Instalé", montar: "Monté", revisar: "Revisé",
    cumplir: "Cumplí", participar: "Participé", capacitar: "Capacité", reducir: "Reduje", mejorar: "Mejoré", asegurar: "Aseguré",
    administrar: "Administré", desarrollar: "Desarrollé", implementar: "Implementé", diagnosticar: "Diagnostiqué", programar: "Programé",
    analizar: "Analicé", verificar: "Verifiqué", registrar: "Registré", cargar: "Cargué", transportar: "Transporté", perforar: "Perforé",
    soldar: "Soldé", preparar: "Preparé", atender: "Atendí", dirigir: "Dirigí", asistir: "Asistí", entregar: "Entregué", efectuar: "Efectué",
    reportar: "Reporté", calibrar: "Calibré", cambiar: "Cambié", lubricar: "Lubriqué", armar: "Armé", desarmar: "Desarmé",
    evaluar: "Evalué", investigar: "Investigué", auditar: "Audité", fiscalizar: "Fiscalicé", velar: "Velé", resguardar: "Resguardé",
    manejar: "Manejé", trasladar: "Trasladé", abastecer: "Abastecí", ordenar: "Ordené", optimizar: "Optimicé", aumentar: "Aumenté",
    lograr: "Logré", formar: "Formé", guiar: "Guié", monitorear: "Monitoreé", medir: "Medí", muestrear: "Muestreé", mapear: "Mapeé",
    modelar: "Modelé", estimar: "Estimé", dibujar: "Dibujé", diseñar: "Diseñé", calcular: "Calculé", detectar: "Detecté",
  };
  // Raíz → infinitivo, para reconocer "Opera", "Operación de", "Operando"…
  const ROOTS = Object.keys(VERBOS).map((inf) => [inf.slice(0, -2), inf]).sort((a, b) => b[0].length - a[0].length);
  const NOUN_START = [
    [/^encargad[oa] de(l)? /i, "Me encargué de$1 "], [/^responsable de(l)? /i, "Fui responsable de$1 "],
    [/^a cargo de(l)? /i, "Estuve a cargo de$1 "], [/^funciones? de /i, "Realicé "], [/^labores de /i, "Realicé labores de "],
    [/^apoyo (en|a) /i, "Apoyé $1 "], [/^mantenci[oó]n /i, "Realicé mantención "], [/^mantenimiento /i, "Realicé mantenimiento "],
    [/^control de /i, "Controlé "], [/^manejo de /i, "Manejé "], [/^uso de /i, "Usé "],
  ];

  // Infinitivo del verbo con que empieza una línea, solo si es una forma verbal o un sustantivo de acción
  // ("Operar", "Opera", "Operando", "Operación"), no un cargo ("Mantenedor", "Operador")
  const VERB_SUFFIX = /^(ar|er|ir|a|e|o|ando|iendo|endo|aci[oó]n|ici[oó]n|ci[oó]n|i[oó]n|imiento|amiento|miento)$/;
  function verbOf(word) {
    const w = norm(word).replace(/[^a-zñ]/g, "");
    const hit = ROOTS.find(([root]) => w.startsWith(root) && VERB_SUFFIX.test(w.slice(root.length)));
    return hit ? hit[1] : null;
  }

  function toAchievement(line) {
    let s = clean(line).replace(/[.;]+$/, "");
    if (!s) return "";
    for (const [re, rep] of NOUN_START) if (re.test(s)) return cap(s.replace(re, rep));
    const first = norm(s.split(/\s+/)[0]);
    // Ya está en pasado (termina en é/í/ó/e acentuada) o empieza con "Fui", "Me"
    if (/^(fui|me|estuve|logre|obtuve|hice|tuve|puse|conduje|reduje|mantuve)$/.test(first) || /(e|i)$/.test(first) && /[éí]/.test(s.split(/\s+/)[0])) return cap(s);
    const inf = verbOf(s.split(/\s+/)[0]);
    if (!inf) return cap(s);
    const rest = s.split(/\s+/).slice(1).join(" ");
    // "Operación de camiones" → "Operé camiones"
    const tail = /^(de|del)\s/i.test(rest) && /cion$|miento$/.test(first) ? rest.replace(/^del?\s+/i, (m) => (/del/i.test(m) ? "el " : "")) : rest;
    return (VERBOS[inf] + " " + tail).trim();
  }

  // ---------- Fechas ----------
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MES_RE = "(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:t(?:iembre)?)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)";
  const NOW_RE = /^((a )?la fecha|actual(idad|mente)?|presente|hoy|vigente)$/i;
  const DATE_PART = `(?:${MES_RE}\\.?\\s*(?:de\\s*)?(?:19|20)\\d{2}|\\d{1,2}[/.-](?:19|20)\\d{2}|(?:19|20)\\d{2})`;
  const RANGE_RE = new RegExp(`(${DATE_PART})\\s*(?:-|–|—|a|al|hasta)\\s*(${DATE_PART}|actual(?:idad|mente)?|presente|la fecha|hoy)`, "i");
  const COMPANY_RE = /\b(s\.?a\.?|s\.?p\.?a\.?|ltda\.?|limitada|minera|compa[nñ][ií]a|codelco|bhp|anglo|contratista|servicios|transportes|constructora|ingenier[ií]a y)\b/i;
  const SINGLE_YEAR_RE = new RegExp(`(${DATE_PART})`, "i");

  function fmtDate(raw) {
    const s = norm(raw).trim();
    if (!s) return "";
    if (NOW_RE.test(s)) return "Actual";
    let m = s.match(new RegExp(`^${MES_RE}\\.?\\s*(?:de\\s*)?((?:19|20)\\d{2})$`));
    if (m) { const k = m[1].slice(0, 3) === "set" ? "sep" : m[1].slice(0, 3); return `${k} ${m[2]}`; }
    m = s.match(/^(\d{1,2})[/.-]((?:19|20)\d{2})$/);
    if (m && +m[1] >= 1 && +m[1] <= 12) return `${MESES[+m[1] - 1]} ${m[2]}`;
    m = s.match(/((?:19|20)\d{2})/);
    return m ? m[1] : clean(raw);
  }
  // "mar 2019 - actual" → ["mar 2019", "actual"]; también "2019-2021" y "03-2019 - 05-2021"
  function rangeParts(s) {
    const p = String(s).split(/\s+(?:-|–|—|a|al|hasta)\s+|\s*[–—]\s*/i);
    if (p.length >= 2) return [p[0], p[p.length - 1]];
    const q = String(s).match(/^(.*?\d{4})\s*-\s*(.*)$/);
    return q ? [q[1], q[2]] : [s, ""];
  }
  const yearOf = (d) => { if (d === "Actual") return new Date().getFullYear() + 0.5; const m = String(d).match(/(19|20)\d{2}/); return m ? +m[0] : 0; };

  // ---------- Secciones del texto ----------
  const SECTIONS = [
    ["perfil", /^(perfil( profesional| laboral)?|resumen( profesional)?|objetivo( profesional| laboral)?|sobre m[ií]|presentaci[oó]n|extracto)$/],
    ["experiencia", /^(experiencia( laboral| profesional)?|antecedentes laborales|trayectoria( laboral| profesional)?|historial laboral|empleos?)$/],
    ["educacion", /^(educaci[oó]n|estudios|formaci[oó]n( acad[eé]mica| profesional)?|antecedentes acad[eé]micos|t[ií]tulos?)$/],
    ["certificaciones", /^(cursos?|certificaci[oó]n(es)?|capacitaci[oó]n(es)?|licencias?( de conducir)?|cursos y certificaciones|licencias,? cursos.*|perfeccionamiento|acreditaciones)$/],
    ["habilidades", /^(habilidades|competencias|conocimientos|aptitudes|herramientas|software|idiomas|habilidades t[eé]cnicas)$/],
    ["disponibilidad", /^(disponibilidad|otros( antecedentes)?|informaci[oó]n adicional)$/],
    ["personal", /^(datos personales|antecedentes personales|informaci[oó]n personal|referencias)$/],
  ];
  function sectionOf(line) {
    const s = norm(line).replace(/[:.\-–_]+$/g, "").trim();
    if (!s || s.length > 45) return null;
    const hit = SECTIONS.find(([, re]) => re.test(s));
    return hit ? hit[0] : null;
  }

  function parseText(text) {
    const out = { perfil: [], experiencia: [], educacion: [], certificaciones: [], habilidades: [], disponibilidad: [], otro: [] };
    let cur = "perfil";
    let seenHeading = false;
    String(text || "").split(/\r?\n/).map((l) => l.trim()).forEach((line) => {
      if (!line) { out[cur === "personal" ? "otro" : cur].push(""); return; }
      const sec = sectionOf(line);
      if (sec) { cur = sec; seenHeading = true; return; }
      if (/\[(nombre|rut|tel[ée]fono|correo|direcci[óo]n|linkedin|dato personal omitido)\]/i.test(line) && line.length < 90) return;
      if (cur === "personal") return;
      out[!seenHeading && cur === "perfil" && RANGE_RE.test(line) ? "experiencia" : cur].push(line);
    });
    return out;
  }

  // ¿La línea describe una función ("Operación de…", "Encargado de…", "Realizar…") y no un cargo o empresa?
  function looksLikeTask(line) {
    const s = clean(line);
    if (NOUN_START.some(([re]) => re.test(s))) return true;
    return !!verbOf(s.split(/\s+/)[0]) && !/[|]|\s[-–—]\s/.test(s);
  }

  // Bloques de experiencia: cada rango de fechas abre un puesto. El cargo y la empresa pueden ir
  // antes o después de las fechas ("Operador CAEX - Minera X" + "03/2019 - actual" o al revés).
  function parseExperience(lines) {
    const items = [];
    const blank = () => ({ cargo: "", empresa: "", lugar: "", inicio: "", fin: "", logros: [] });
    let cur = null, header = [];
    const applyHeader = (item) => {
      const parts = header.flatMap((h) => h.split(/\s+[|·•]\s+|\s+[-–—]\s+|,\s+(?=[A-ZÁÉÍÓÚ])/)).map(clean).filter(Boolean);
      if (!item.cargo) item.cargo = parts.shift() || "";
      if (!item.empresa) item.empresa = parts.shift() || "";
      if (!item.lugar) item.lugar = parts.shift() || "";
      header = [];
    };
    lines.forEach((line) => {
      if (!line) return;
      const m = line.match(RANGE_RE);
      const isBullet = /^[\s•·\-–—*●▪►>✓]/.test(line);
      if (m && !isBullet) {
        const [ini, fin] = rangeParts(m[0]);
        const rest = clean(line.replace(m[0], "").replace(/[()]/g, " "));
        // Fechas justo después de un encabezado del puesto actual (aún sin fechas ni logros): completan ese puesto
        if (cur && !cur.inicio && !cur.logros.length) { cur.inicio = fmtDate(ini); cur.fin = fmtDate(fin); }
        else { cur = blank(); cur.inicio = fmtDate(ini); cur.fin = fmtDate(fin); items.push(cur); }
        if (rest) header.push(rest);
        if (header.length) applyHeader(cur);
        return;
      }
      // Termina en punto como oración (no como "S.A." o "Ltda.")
      const sentence = /[.;]$/.test(line) && !COMPANY_RE.test(line.split(/\s+/).pop());
      // Después de logros, solo es encabezado de un puesto nuevo si trae separador o nombre de empresa
      const isHeader = !isBullet && line.length < 80 && !sentence && !looksLikeTask(line) &&
        (!cur || !cur.logros.length || /\s[|·•]\s|\s[-–—]\s|,\s/.test(line) || COMPANY_RE.test(line));
      if (isHeader) {
        if (!cur || cur.logros.length || (cur.cargo && cur.empresa)) { cur = blank(); items.push(cur); }
        header.push(line);
        applyHeader(cur);
        return;
      }
      if (!cur) { cur = blank(); items.push(cur); }
      line.split(/(?<=[.;])\s+(?=[A-ZÁÉÍÓÚ])/).forEach((p) => { const a = toAchievement(p); if (a.length > 3) cur.logros.push(a); });
    });
    // Si el cargo quedó vacío pero hay encabezado previo a las fechas, ya se usó; corregir orden "Empresa / Cargo"
    items.forEach((e) => {
      if (/\b(s\.?a\.?|ltda|spa|limitada|minera|compa[nñ][ií]a|codelco|bhp|anglo|antofagasta minerals|contratista)\b/i.test(e.cargo) && e.empresa && !/\b(s\.?a\.?|ltda|spa|minera)\b/i.test(e.empresa)) {
        [e.cargo, e.empresa] = [e.empresa, e.cargo];
      }
    });
    return items.filter((e) => e.cargo || e.logros.length);
  }

  function parseEducation(lines) {
    const items = [];
    lines.filter(Boolean).forEach((line) => {
      const m = line.match(RANGE_RE) || line.match(SINGLE_YEAR_RE);
      const rest = clean(line.replace(m ? m[0] : "", "").replace(/[()]/g, " "));
      const parts = rest.split(/\s+[|·•]\s+|\s+[-–—]\s+|,\s+/).map(clean).filter(Boolean);
      const isInst = (s) => /universidad|instituto|inacap|duoc|cft|liceo|colegio|escuela|centro de formaci|ip |aiep|santo tom/i.test(s);
      if (!parts.length && m && items.length && !items[items.length - 1].fin) { items[items.length - 1].fin = fmtDate(m[0]); return; }
      const last = items[items.length - 1];
      // Institución sola en su línea: completa el estudio anterior o queda esperando el título
      if (parts.length === 1 && isInst(parts[0])) {
        if (last && !last.institucion) last.institucion = parts[0];
        else items.push({ titulo: "", institucion: parts[0], inicio: "", fin: "" });
        if (m && !items[items.length - 1].fin) items[items.length - 1].fin = fmtDate(rangeParts(m[0]).pop() || m[0]);
        return;
      }
      // Título que llega después de su institución
      if (last && !last.titulo && parts.length === 1) {
        last.titulo = parts[0];
        if (m && !last.fin) last.fin = fmtDate(rangeParts(m[0]).pop() || m[0]);
        return;
      }
      let titulo = parts[0] || "", institucion = parts[1] || "";
      if (isInst(titulo) && institucion && !isInst(institucion)) [titulo, institucion] = [institucion, titulo];
      const rng = line.match(RANGE_RE);
      const [ini, fin] = rng ? rangeParts(rng[0]) : ["", m ? m[0] : ""];
      items.push({ titulo, institucion, inicio: fmtDate(ini), fin: fmtDate(fin) });
    });
    return items.filter((e) => e.titulo);
  }

  const splitList = (lines) => uniq(lines.filter(Boolean).flatMap((l) => (l.length > 60 && !/[,;·•]/.test(l) ? [l] : l.split(/\s*[,;·•|]\s*/))).map(clean).filter((x) => x.length > 1).map(cap));

  // Licencias y cursos que se reconocen en cualquier parte del CV
  const CERT_PATTERNS = [
    [/licencia(?: de conducir)?(?: profesional)?(?: clase)?\s*(a-?[1-5]|b|c|d|e)\b/gi, (m) => "Licencia clase " + m[1].replace("-", "").toUpperCase()],
    [/\bclase\s*(a-?[1-5]|d)\b/gi, (m) => "Licencia clase " + m[1].replace("-", "").toUpperCase()],
    [/altura geogr[aá]fica/gi, () => "Examen de altura geográfica"],
    [/altura f[ií]sica|trabajo en altura/gi, () => "Curso de trabajo en altura física"],
    [/primeros auxilios/gi, () => "Primeros auxilios"],
    [/manejo defensivo/gi, () => "Manejo defensivo"],
    [/conducci[oó]n 4x4|manejo 4x4/gi, () => "Conducción 4x4"],
    [/espacios? confinados?/gi, () => "Trabajo en espacios confinados"],
    [/rigger|aparejador/gi, () => "Rigger / aparejador"],
    [/iso\s*45001/gi, () => "ISO 45001"], [/iso\s*14001/gi, () => "ISO 14001"], [/iso\s*9001/gi, () => "ISO 9001"],
    [/sernageomin/gi, () => "Inducción SERNAGEOMIN"],
    [/certificaci[oó]n aws|\baws\b/gi, () => "Certificación AWS"],
    [/licencia sec|instalador el[eé]ctrico sec|clase [abcd] sec/gi, () => "Licencia SEC"],
    [/chilevalora/gi, () => "Certificación de competencias ChileValora"],
  ];
  function findCerts(text) {
    const found = [];
    CERT_PATTERNS.forEach(([re, fn]) => { for (const m of String(text).matchAll(re)) found.push(fn(m)); });
    return uniq(found);
  }

  // Lo que la persona pide destacar: se agrega solo si lo declara ("tengo…", "lideré…")
  function parseDestacar(destacar) {
    const declared = [], unconfirmed = [];
    String(destacar || "").split(/\s*(?:,|;|\n|\sy\s(?=tengo|cuento|lider|manejo|soy|hablo))\s*/i).map(clean).filter(Boolean).forEach((item) => {
      if (/^(tengo|cuento con|poseo|soy|hablo|manejo|domino|lider[eé]|trabaj[eé]|oper[eé]|estoy|dispongo|disponibilidad)/i.test(item)) declared.push(item);
      else unconfirmed.push(item);
    });
    return { declared, unconfirmed };
  }

  // ---------- Análisis principal ----------
  function analyze(payload) {
    const cargoObj = clean(payload.cargo);
    let cv, originalText;
    if (payload.cvText) {
      originalText = payload.cvText;
      const p = parseText(payload.cvText);
      const perfil = p.perfil.filter(Boolean).filter((l) => l.length > 25).join(" ");
      cv = {
        titular: "", perfil: clean(perfil),
        experiencia: parseExperience(p.experiencia),
        educacion: parseEducation(p.educacion),
        certificaciones: splitList(p.certificaciones),
        habilidades: splitList(p.habilidades).filter((h) => h.length <= 60),
        disponibilidad: clean(p.disponibilidad.filter(Boolean).join(" ")),
      };
    } else {
      const c = payload.cv || {};
      cv = {
        titular: clean(c.titular), perfil: clean(c.perfil),
        experiencia: (c.experiencia || []).map((e) => ({ cargo: clean(e.cargo), empresa: clean(e.empresa), lugar: clean(e.lugar),
          inicio: fmtDate(e.inicio), fin: fmtDate(e.fin), logros: (e.logros || []).map(toAchievement).filter(Boolean) })),
        educacion: (c.educacion || []).map((e) => ({ titulo: clean(e.titulo), institucion: clean(e.institucion), inicio: fmtDate(e.inicio), fin: fmtDate(e.fin) })),
        certificaciones: uniq((c.certificaciones || []).map(clean).map(cap)),
        habilidades: uniq((c.habilidades || []).map(clean).map(cap)),
        disponibilidad: clean(c.disponibilidad),
      };
      originalText = JSON.stringify(c);
    }
    const textN = norm(originalText);
    const role = pickRole(cargoObj || cv.titular || (cv.experiencia[0] || {}).cargo, originalText);

    // Diagnóstico sobre el CV original (antes de reestructurar)
    const exps = cv.experiencia;
    const withDates = exps.filter((e) => e.inicio && e.fin).length;
    const logros = exps.flatMap((e) => e.logros);
    // Cifras de resultados (no modelos de equipos como "930E")
    const quantified = logros.filter((l) => /(^|\s)\d+([.,]\d+)?\s*(%|personas|trabajador|equipos|horas|hrs|turnos|toneladas|ton|km|años|meses|días|operador|camiones|millones|metros|m3|accidentes|integrantes)/i.test(l)).length;
    // Licencias y cursos con un solo nombre ("Licencia A4" y "licencia clase A4" son lo mismo)
    const canon = (c) => { const f = findCerts(c); return f.length === 1 ? f[0] : cap(c); };
    const certsAll = uniq([...cv.certificaciones.map(canon), ...findCerts(originalText)]);
    const roleKw = role ? role.kw : GENERAL_KW;
    const flat = (s) => norm(s).replace(/[^a-z0-9]+/g, " ").trim();
    const textF = " " + flat(originalText) + " ";
    // "Licencia A4 o A5" se cumple con cualquiera de las dos
    const hasLicense = (k) => (k.match(/\b(A[1-5]|D|SEC)\b/g) || []).some((id) => certsAll.some((c) => new RegExp("\\b" + id + "$").test(c)));
    const kwHave = roleKw.filter((k) => (/^licencia/i.test(k) ? hasLicense(k) : textF.includes(" " + flat(k) + " ")));
    const kwMissing = roleKw.filter((k) => !kwHave.includes(k));
    const years = exps.flatMap((e) => [yearOf(e.inicio), yearOf(e.fin)]).filter(Boolean);
    const span = years.length ? Math.max(1, Math.floor(Math.max(...years) - Math.min(...years))) : 0;

    const checks = [
      { w: 10, ok: (cv.perfil || "").length >= 80, fort: "Tiene un perfil profesional que resume su experiencia.", brecha: "Agrega un perfil de 3 o 4 líneas al inicio: años de experiencia, especialidad, faenas y qué aportas al cargo." },
      { w: 15, ok: exps.length >= 1 && exps.every((e) => e.cargo && e.empresa), fort: `Experiencia laboral identificable en ${exps.length} ${exps.length === 1 ? "puesto" : "puestos"}.`, brecha: "Cada experiencia debe indicar claramente cargo y empresa (contratista o mandante)." },
      { w: 10, ok: exps.length && withDates === exps.length, fort: "Todas las experiencias tienen fechas de inicio y término.", brecha: "Agrega mes y año de inicio y término en cada experiencia; los reclutadores descartan CV sin fechas." },
      { w: 15, ok: logros.length >= exps.length * 2 && exps.length > 0, fort: "Describe funciones concretas en sus cargos.", brecha: "Describe 2 a 5 funciones o logros por cargo, empezando con un verbo (Operé, Realicé, Lideré)." },
      { w: 10, ok: quantified >= 1, fort: "Incluye logros con cifras (equipos, personas, metas).", brecha: "Suma cifras reales: tamaño de equipos, cantidad de personas a cargo, horas sin accidentes o metas cumplidas." },
      { w: 10, ok: cv.educacion.length >= 1, fort: "Indica su formación académica.", brecha: "Agrega tus estudios (enseñanza media técnica, CFT, IP o universidad) con institución y año." },
      { w: 10, ok: certsAll.length >= 1, fort: `Declara licencias o cursos: ${certsAll.slice(0, 4).join(", ")}.`, brecha: "Agrega una sección de licencias y cursos (clase D, A4/A5, altura física, primeros auxilios). En minería pesan mucho." },
      { w: 10, ok: cv.habilidades.length >= 5, fort: "Lista habilidades técnicas.", brecha: "Agrega al menos 5 habilidades técnicas: equipos que operas, sistemas y herramientas." },
      { w: 10, ok: kwHave.length >= Math.ceil(roleKw.length / 3), fort: `Usa términos que buscan los reclutadores: ${kwHave.slice(0, 4).join(", ")}.`, brecha: `Incluye palabras clave del cargo${role ? " de " + role.titulo.toLowerCase() : ""} que sí tengas (revisa la lista de abajo).` },
    ];
    let puntaje = Math.round(checks.reduce((a, c) => a + (c.ok ? c.w : 0), 0));
    puntaje = Math.max(5, Math.min(100, puntaje));
    const fortalezas = checks.filter((c) => c.ok).map((c) => c.fort).slice(0, 5);
    const brechas = checks.filter((c) => !c.ok).map((c) => c.brecha).slice(0, 6);
    if (!fortalezas.length) fortalezas.push("Ya tienes un punto de partida: con algunos ajustes tu CV puede competir mejor.");

    // ---------- CV reestructurado ----------
    const pendientes = [];
    const { declared, unconfirmed } = parseDestacar(payload.destacar);
    declared.forEach((d) => {
      const fromCert = findCerts(d);
      if (fromCert.length) certsAll.push(...fromCert);
      else if (/^disponibilidad|^dispongo/i.test(d)) cv.disponibilidad = cv.disponibilidad || cap(d.replace(/^dispongo de\s*/i, "Disponibilidad para "));
      else cv.habilidades.push(cap(d.replace(/^(tengo|cuento con|poseo|manejo|domino)\s+/i, "")));
    });
    unconfirmed.forEach((d) => {
      if (!textN.includes(norm(d))) pendientes.push(`Pediste destacar “${d}”, pero tu CV no lo menciona. Si lo tienes, agrégalo con detalle (dónde y desde cuándo).`);
    });

    exps.forEach((e) => {
      if (!e.cargo) e.cargo = "[completar]";
      if (!e.empresa) e.empresa = "[completar]";
      if (!e.inicio) e.inicio = "[completar]";
      if (!e.fin) e.fin = "[completar]";
      e.logros = uniq(e.logros).slice(0, 6);
      if (!e.logros.length) e.logros = ["[completar: principal función o logro en este cargo]"];
    });
    exps.sort((a, b) => yearOf(b.fin) - yearOf(a.fin) || yearOf(b.inicio) - yearOf(a.inicio));
    const missingDates = exps.filter((e) => e.inicio === "[completar]" || e.fin === "[completar]").length;
    if (missingDates) pendientes.push(`Completa las fechas en ${missingDates} ${missingDates === 1 ? "experiencia" : "experiencias"} (mes y año).`);
    if (exps.some((e) => e.empresa === "[completar]")) pendientes.push("Indica el nombre de la empresa en cada experiencia.");
    if (!quantified && exps.length) pendientes.push("Si puedes, agrega una cifra real a tus logros (personas a cargo, equipos, metas o tiempo sin accidentes).");

    const lic = certsAll.find((c) => /clase (A4|A5|D)/.test(c));
    const titulo = cargoObj ? cap(cargoObj) : cv.titular || (exps[0] && exps[0].cargo !== "[completar]" ? exps[0].cargo : role ? role.titulo : "");
    cv.titular = titulo ? titulo + (lic && !norm(titulo).includes(norm(lic)) ? " · " + lic.replace("Licencia clase ", "Licencia ") : "") : "[completar: cargo al que postulas]";

    if ((cv.perfil || "").length < 80) {
      const empresas = uniq(exps.map((e) => e.empresa).filter((x) => x && x !== "[completar]")).slice(0, 3);
      // Especialidades para el perfil: palabras clave que sí tiene (sin licencias, que van en su sección)
      const skills = uniq([...kwHave, ...cv.habilidades]).filter((s) => !/^(licencia|examen|turnos)/i.test(s)).slice(0, 3)
        .map((s) => (/^[A-Z0-9/]{2,}$/.test(s.split(" ")[0]) ? s : s.toLowerCase()));
      cv.perfil = [
        `${titulo || "Profesional"} con ${span ? span + (span === 1 ? " año" : " años") : "[completar] años"} de experiencia${empresas.length ? " en " + empresas.join(", ") : " en minería"}.`,
        skills.length ? `Experiencia en ${skills.join(", ")}.` : "",
        "Comprometido con la seguridad, el trabajo en equipo y el cumplimiento de metas en faena.",
        cv.disponibilidad ? "" : "Disponibilidad para trabajar en sistema de turnos.",
      ].filter(Boolean).join(" ");
      pendientes.push("Revisa el perfil profesional que armamos con tus datos y ajústalo con tus palabras.");
    }
    cv.certificaciones = uniq(certsAll).slice(0, 15);
    cv.habilidades = uniq(cv.habilidades).slice(0, 15);
    if (!cv.disponibilidad) pendientes.push("Indica tu disponibilidad: turnos (7x7, 4x3…) y si puedes trasladarte a faena.");

    const diagnostico = [
      puntaje >= 75 ? "Tu CV tiene una buena base para postular." : puntaje >= 50 ? "Tu CV tiene información útil, pero le faltan elementos que los reclutadores mineros revisan primero." : "Tu CV necesita más información para competir en procesos de selección mineros.",
      role ? `Lo revisamos para el cargo de ${(cargoObj || role.titulo).toLowerCase()}: contiene ${kwHave.length} de ${roleKw.length} palabras clave habituales.` : "Indica el cargo al que postulas para un análisis más preciso de palabras clave.",
      brechas.length ? "Abajo están las mejoras más importantes, ordenadas por impacto." : "Revisa los detalles finales y descárgalo.",
    ].join(" ");

    return {
      puntaje, diagnostico, fortalezas, brechas,
      // Sin las que la persona declaró tener al pedir qué destacar
      palabras_clave_faltantes: kwMissing.filter((k) => !cv.certificaciones.some((c) => flat(c) === flat(k))).slice(0, 12),
      pendientes: uniq(pendientes),
      cv,
      motor: "local",
    };
  }

  window.CvLocal = { analyze, toAchievement, parseText };
})();
