// Genera páginas estáticas para Google a partir de site/data/jobs.json:
//   /oferta/<slug>          una página por oferta, con datos JobPosting (Google Empleos)
//   /empleos/               índice de regiones y cargos
//   /empleos/<region>       ofertas de una región (ej. /empleos/antofagasta)
//   /empleos/<cargo>        ofertas de un tipo de cargo (ej. /empleos/operador-de-equipos)
// Además agrega a cada oferta de jobs.json el campo "page" y rehace sitemap.xml.
//
// Se ejecuta en GitHub Actions DESPUÉS de guardar jobs.json en el repo, así estas
// páginas solo viajan en la publicación y no llenan el repositorio de archivos.
// Uso local: node scripts/build_pages.mjs   (opcional: SITE_URL=https://...)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "site");
const BASE = (process.env.SITE_URL || "https://trabajaenmineria.cl").replace(/\/$/, "");
const MIN_JOBS_PAGE = 3; // una región o cargo necesita al menos estas ofertas para tener página

// ---------- Utilidades ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slugify = (s, max = 70) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
const jsonLd = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const clean = (s) => String(s || "").replace(/\s+/g, " ").replace(/\s?\?\s(?=[A-ZÁÉÍÓÚ])/g, " – ").trim();
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const fecha = (d) => `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const isoDay = (d) => d.toISOString().slice(0, 10);

// Título con mayúscula inicial (algunos portales los publican en MAYÚSCULAS)
function prettyTitle(t) {
  t = clean(t);
  const letters = t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  if (letters && letters === letters.toUpperCase() && letters.length > 6) {
    t = t.toLowerCase().replace(/(^|[\s(/-])([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase());
  }
  return t;
}

// ---------- Regiones ----------
const REGIONES = {
  "Arica y Parinacota": "La región más al norte de Chile. Aquí la minería convive con el puerto de Arica y la logística hacia Bolivia y Perú: aparecen cargos de transporte, mantención y servicios a faenas del altiplano.",
  "Tarapacá": "Iquique, Alto Hospicio y Pozo Almonte concentran el empleo minero de la región. En el altiplano operan grandes faenas de cobre como Collahuasi y Quebrada Blanca, que buscan operadores, mantenedores y personal de construcción y servicios.",
  "Antofagasta": "La capital minera de Chile. Calama, Antofagasta, Mejillones, Sierra Gorda y Taltal reúnen faenas como Chuquicamata, Radomiro Tomic, Escondida y Spence, además de cientos de empresas contratistas. Es la región con más ofertas del sitio.",
  "Atacama": "Copiapó, Vallenar, Tierra Amarilla y Diego de Almagro son el centro del empleo minero de la región, con faenas como Candelaria, El Salvador y Caserones, y una gran red de pequeña y mediana minería.",
  "Coquimbo": "La Serena, Coquimbo, Ovalle, Andacollo y Salamanca concentran el empleo minero de la región, con faenas como Los Pelambres y Andacollo, y muchos proveedores de servicios y mantención.",
  "Valparaíso": "Los Andes, San Felipe, Nogales y Catemu reúnen el empleo minero de la región, con faenas como Andina y El Soldado, además de puertos y fundiciones que contratan personal de operación y mantención.",
  "Metropolitana": "Santiago concentra las casas matrices de las mineras y de muchos contratistas: aquí se publican cargos de ingeniería, administración, abastecimiento y proyectos, y también turnos para faenas del norte. En la región opera Los Bronces.",
  "O'Higgins": "Rancagua y Machalí son la puerta de entrada a El Teniente, la mina subterránea de cobre más grande del mundo. Se buscan operadores, mantenedores, eléctricos y personal de proyectos.",
  "Maule": "Talca y Curicó tienen ofertas de proveedores mineros, maestranzas y empresas de servicios que trabajan para faenas en otras regiones.",
  "Ñuble": "Chillán y sus alrededores tienen ofertas de empresas de servicios, transporte y maestranzas ligadas a la minería.",
  "Biobío": "Concepción, Talcahuano y Coronel reúnen maestranzas, fundiciones y proveedores industriales que trabajan para la minería de todo el país.",
  "Araucanía": "Temuco y sus alrededores tienen ofertas de empresas de servicios y proveedores ligados a la minería, muchas con turnos en faenas del norte.",
  "Los Ríos": "Valdivia tiene ofertas puntuales de proveedores y servicios para la minería.",
  "Los Lagos": "Puerto Montt y Osorno tienen ofertas puntuales de proveedores y servicios para la minería.",
  "Aysén": "En Aysén hay faenas de minería metálica en la zona de Chile Chico y Cerro Bayo, con ofertas puntuales de operación y servicios.",
  "Magallanes": "Punta Arenas y Tierra del Fuego tienen ofertas de minería del carbón, hidrocarburos y servicios asociados.",
};

// ---------- Cargos (se detectan por el título de la oferta) ----------
const CARGOS = [
  { slug: "operador-de-equipos", name: "Operador de equipos", plural: "Operadores de equipos", re: /operador|operadora|operario/,
    intro: "Operadores de camión de extracción, cargador, bulldozer, motoniveladora, grúa, planta y equipos auxiliares. Normalmente piden licencia de conducir profesional (A2, A4 o A5, o clase D para maquinaria), enseñanza media completa y aprobar los exámenes preocupacionales.",
    tip: "Si no tienes experiencia, revisa los programas de formación de operadores de las mineras y de las OTEC: muchas empresas contratan egresados de esos cursos." },
  { slug: "mantenedor-mecanico", name: "Mantenedor mecánico", plural: "Mantenedores mecánicos", re: /mantenedor|mantencion|mantenimiento|mecanic|maestro mayor|maestro mecanico|vulcaniz|lubric/,
    intro: "Mantenedores mecánicos de equipos móviles y fijos, maestros, vulcanizadores y lubricadores. Es uno de los perfiles más buscados de la gran minería: valoran el título técnico, la experiencia en equipos de faena y los cursos de la marca del equipo.",
    tip: "Destaca en tu CV los equipos y marcas que conoces (Komatsu, Caterpillar, Liebherr, etc.) y los años de experiencia en cada uno." },
  { slug: "electrico-e-instrumentista", name: "Eléctrico e instrumentista", plural: "Eléctricos e instrumentistas", re: /electric|electromec|instrument|automatiz|electronic/,
    intro: "Eléctricos, electromecánicos, instrumentistas y técnicos en automatización para plantas, chancado y equipos móviles. Suelen pedir licencia SEC, título técnico y experiencia en mantención industrial.",
    tip: "Si tienes licencia SEC, indícala con su clase al inicio del CV: es un filtro habitual de selección." },
  { slug: "conductor-y-chofer", name: "Conductor y chofer", plural: "Conductores y choferes", re: /conductor|chofer|camion(?!eta)|licencia a[2-5]|transport/,
    intro: "Conductores de buses de personal, camiones, camionetas y vehículos de apoyo para faenas. Piden licencia profesional vigente (A2, A3, A4 o A5), hoja de vida del conductor y, muchas veces, curso de manejo a la defensiva.",
    tip: "Lleva tu hoja de vida del conductor actualizada (se pide en el Registro Civil) y la licencia vigente." },
  { slug: "prevencionista-de-riesgos", name: "Prevencionista de riesgos", plural: "Prevencionistas de riesgos", re: /prevenc|hse|\bsso\b|seguridad y salud|medio ambiente|higien/,
    intro: "Prevencionistas de riesgos, asesores HSE y de medio ambiente para faenas y contratistas. Piden título técnico o profesional en prevención de riesgos y registro SEREMI de Salud.",
    tip: "Indica tu registro SEREMI (categoría y número) y la experiencia en faena con contratistas." },
  { slug: "supervisor-y-jefatura", name: "Supervisor y jefatura", plural: "Supervisores y jefaturas", re: /supervisor|jefe|jefa|capataz|encargad|coordinador|administrador de contrato|lider/,
    intro: "Supervisores, jefes de turno, capataces, coordinadores y administradores de contrato. Piden experiencia liderando equipos en faena y, según el cargo, título técnico o profesional.",
    tip: "Cuenta cuántas personas tuviste a cargo y qué resultados lograste (seguridad, disponibilidad de equipos, costos)." },
  { slug: "ingeniero", name: "Ingeniero", plural: "Ingenieros", re: /ingenier/,
    intro: "Ingenieros de procesos, mantenimiento, confiabilidad, planificación, proyectos y minas. Valoran la experiencia en faena, el manejo de software de planificación y los idiomas.",
    tip: "Ajusta tu CV a cada área (planificación, confiabilidad, proyectos) con los programas y metodologías que usas." },
  { slug: "geologo-y-topografo", name: "Geólogo y topógrafo", plural: "Geólogos y topógrafos", re: /geolog|topograf|geomensur|sondaj|muestrer|perfor/,
    intro: "Geólogos, topógrafos, sondajistas, perforistas y muestreros para exploración y operación. Piden título técnico o profesional según el cargo y experiencia con equipos y software del área.",
    tip: "Menciona los equipos y programas que manejas (estación total, GPS, Leapfrog, Vulcan, etc.)." },
  { slug: "soldador", name: "Soldador", plural: "Soldadores y caldereros", re: /soldad|calderer|armador|estructur/,
    intro: "Soldadores calificados, caldereros, armadores y montajistas de estructuras para mantención y proyectos. Normalmente piden certificación de soldadura vigente.",
    tip: "Incluye tus certificaciones de soldadura con el proceso y la posición (por ejemplo, SMAW 6G)." },
  { slug: "bodega-y-logistica", name: "Bodega y logística", plural: "Bodega y logística", re: /bodeg|logistic|abastec|compras|inventari|despach|almacen/,
    intro: "Bodegueros, operadores de grúa horquilla, encargados de inventario, compradores y personal de abastecimiento para faenas y contratistas.",
    tip: "Si tienes licencia de grúa horquilla o manejo de SAP, ponlo arriba en el CV." },
  { slug: "administrativo", name: "Administrativo", plural: "Administrativos", re: /administrativ|asistente|secretari|recepcion|analista|contador|contable|recursos humanos|rrhh|remuneracion/,
    intro: "Administrativos de faena, asistentes, analistas, personal de recursos humanos y remuneraciones. Muchas ofertas son en ciudades y algunas en campamento con turnos.",
    tip: "Destaca el manejo de Excel y de sistemas como SAP, y la experiencia en contratos o faena." },
  { slug: "sin-experiencia", name: "Sin experiencia", plural: "Ayudantes y cargos sin experiencia", re: /ayudante|auxiliar|aprendiz|practica|practicante|sin experiencia|junior|trainee|aseo|mucam|garzon|cocin|guardia/,
    intro: "Ayudantes, auxiliares, aprendices, practicantes y cargos de servicios en faena (aseo, alimentación, guardias). Son la puerta de entrada más común para quienes quieren empezar en la minería.",
    tip: "Lee la guía para entrar a la minería sin experiencia: explica qué cursos y licencias te abren más puertas." },
];

// Perfil de cada cargo: qué hace y qué se suele pedir (texto general, orientativo)
const PERFILES = {
  "operador-de-equipos": {
    hace: ["Opera camiones de extracción, cargadores, bulldozers, motoniveladoras, grúas o equipos de planta.", "Revisa el equipo antes de cada turno (check list) e informa fallas.", "Cumple las reglas de tránsito de la faena y los procedimientos de seguridad."],
    pide: ["Enseñanza media completa.", "Licencia de conducir según el equipo (A2, A4, A5 o clase D).", "Curso de operación del equipo y, ojalá, experiencia acreditada.", "Aprobar exámenes preocupacionales y de altura geográfica si la faena lo requiere."],
  },
  "mantenedor-mecanico": {
    hace: ["Realiza mantenciones preventivas y correctivas de equipos móviles o fijos.", "Diagnostica fallas y cambia componentes según pauta del fabricante.", "Registra el trabajo en el sistema de mantenimiento y cuida la disponibilidad de los equipos."],
    pide: ["Título técnico en mecánica (industrial, automotriz o equipo pesado) o experiencia equivalente.", "Experiencia con equipos de faena y conocimiento de sus marcas.", "Cursos de bloqueo y aislación de energías.", "Disponibilidad para turnos y trabajo en altura geográfica."],
  },
  "electrico-e-instrumentista": {
    hace: ["Mantiene sistemas eléctricos, motores, tableros e instrumentos de planta.", "Calibra sensores y apoya la automatización de procesos.", "Trabaja con energías peligrosas siguiendo procedimientos de bloqueo."],
    pide: ["Título técnico o profesional en electricidad, electromecánica o instrumentación.", "Licencia SEC vigente según la clase del trabajo.", "Experiencia en mantención industrial.", "Manejo de planos y diagramas eléctricos."],
  },
  "conductor-y-chofer": {
    hace: ["Traslada personal, materiales o combustible entre ciudad, campamento y faena.", "Cuida el vehículo y su documentación al día.", "Respeta velocidades, descansos y normas de conducción de la faena."],
    pide: ["Licencia profesional vigente (A2, A3, A4 o A5).", "Hoja de vida del conductor sin infracciones graves.", "Curso de manejo a la defensiva (o disposición a hacerlo).", "Exámenes psicosensotécnicos aprobados."],
  },
  "prevencionista-de-riesgos": {
    hace: ["Identifica peligros y propone medidas para controlar los riesgos.", "Inspecciona trabajos, capacita a los equipos e investiga incidentes.", "Lleva la documentación de seguridad exigida por la mandante y la ley."],
    pide: ["Título de técnico o ingeniero en prevención de riesgos.", "Registro vigente en la SEREMI de Salud.", "Experiencia en faena o con empresas contratistas.", "Conocimiento del DS 132 (Reglamento de Seguridad Minera)."],
  },
  "supervisor-y-jefatura": {
    hace: ["Organiza el trabajo de una cuadrilla o un turno.", "Controla el avance, la seguridad y la calidad del trabajo.", "Coordina con la mandante y reporta resultados."],
    pide: ["Experiencia liderando equipos en faena.", "Título técnico o profesional según el área.", "Manejo de planificación y reportes.", "Habilidades de comunicación y resolución de problemas."],
  },
  "ingeniero": {
    hace: ["Planifica, mejora o controla procesos de mina, planta o mantenimiento.", "Analiza datos de producción, costos y confiabilidad.", "Lidera proyectos y coordina con contratistas."],
    pide: ["Título de ingeniería en el área (minas, metalurgia, mecánica, eléctrica, industrial u otra).", "Experiencia en faena según el nivel del cargo.", "Manejo de software de planificación o análisis.", "Inglés, en muchos cargos de grandes mineras."],
  },
  "geologo-y-topografo": {
    hace: ["Toma y analiza muestras, mapea o modela el yacimiento.", "Realiza levantamientos topográficos y control de avance.", "Apoya la perforación, el sondaje y la planificación minera."],
    pide: ["Título técnico o profesional en geología, topografía o geomensura.", "Manejo de estación total, GPS o software de modelamiento.", "Experiencia en terreno.", "Disponibilidad para turnos en zonas remotas."],
  },
  "soldador": {
    hace: ["Suelda, corta y repara estructuras, piping y componentes de equipos.", "Arma y monta estructuras en mantenciones y proyectos.", "Trabaja con permisos de trabajo en caliente."],
    pide: ["Certificación de soldadura vigente (proceso y posición).", "Experiencia en mantención industrial o montaje.", "Lectura de planos.", "Cursos de trabajo en altura y espacios confinados, según el cargo."],
  },
  "bodega-y-logistica": {
    hace: ["Recibe, almacena y despacha repuestos e insumos.", "Controla inventarios en el sistema.", "Coordina compras y traslados a faena."],
    pide: ["Enseñanza media o título técnico en logística o administración.", "Manejo de SAP u otro sistema de inventario.", "Licencia de grúa horquilla, en muchos cargos.", "Orden y responsabilidad con los registros."],
  },
  "administrativo": {
    hace: ["Apoya la gestión de personal, contratos, documentos y pagos.", "Lleva registros y reportes de la faena o la oficina.", "Atiende a trabajadores, contratistas y proveedores."],
    pide: ["Título técnico o profesional en administración, contabilidad o recursos humanos.", "Buen manejo de Excel y sistemas de gestión.", "Experiencia en empresas mineras o contratistas (deseable).", "Disponibilidad para turnos si el cargo es en faena."],
  },
  "sin-experiencia": {
    hace: ["Apoya a operadores, mantenedores y maestros en sus tareas.", "Realiza labores de aseo, orden, alimentación o vigilancia en faena.", "Aprende los procedimientos de seguridad desde el primer día."],
    pide: ["Enseñanza media completa (en la mayoría de los casos).", "Disposición para trabajar en turnos y en zonas remotas.", "Aprobar exámenes preocupacionales.", "Cursos básicos (primeros auxilios, inducción de seguridad) ayudan a destacar."],
  },
};

function perfilHtml(c, headingTag = "h2") {
  const p = PERFILES[c.slug];
  if (!p) return "";
  return `
        <section class="perfil" aria-label="Perfil del cargo">
          <${headingTag}>Perfil del cargo: ${esc(c.name.toLowerCase())}</${headingTag}>
          <div class="perfil-grid">
            <div><h3>Qué hace</h3><ul>${p.hace.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
            <div><h3>Qué suelen pedir</h3><ul>${p.pide.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
          </div>
          <p class="perfil-tip"><b>Consejo:</b> ${esc(c.tip)}</p>
          <p class="perfil-note">Referencia general: cada oferta indica sus requisitos exactos.</p>
        </section>`;
}

function cargoOf(j) {
  const t = norm(j.title);
  return CARGOS.find((c) => c.re.test(t)) || null;
}

// ---------- Datos ----------
const jobsPath = path.join(SITE, "data", "jobs.json");
const data = JSON.parse(fs.readFileSync(jobsPath, "utf8"));
const jobs = (data.jobs || []).filter((j) => j && j.title && j.url);
const updated = data.updated ? new Date(data.updated) : new Date();

const usedSlugs = new Set();
for (const j of jobs) {
  const hash = crypto.createHash("sha1").update(j.url).digest("hex").slice(0, 7);
  let slug = `${slugify(prettyTitle(j.title), 60) || "oferta"}-${hash}`;
  while (usedSlugs.has(slug)) slug += "x";
  usedSlugs.add(slug);
  j._slug = slug;
  j._title = prettyTitle(j.title);
  j._date = j.date ? new Date(j.date) : updated;
  j._cargo = cargoOf(j);
  j.page = `/oferta/${slug}`;
}
jobs.sort((a, b) => b._date - a._date);

const byRegion = new Map();
const byCargo = new Map();
for (const j of jobs) {
  if (j.region && REGIONES[j.region]) (byRegion.get(j.region) || byRegion.set(j.region, []).get(j.region)).push(j);
  if (j._cargo) (byCargo.get(j._cargo.slug) || byCargo.set(j._cargo.slug, []).get(j._cargo.slug)).push(j);
}
const regionPages = [...byRegion].filter(([, l]) => l.length >= MIN_JOBS_PAGE).sort((a, b) => b[1].length - a[1].length);
const cargoPages = CARGOS.map((c) => [c, byCargo.get(c.slug) || []]).filter(([, l]) => l.length >= MIN_JOBS_PAGE);
const regionUrl = (r) => `/empleos/${slugify(r)}`;
const hasRegionPage = new Set(regionPages.map(([r]) => r));
const hasCargoPage = new Set(cargoPages.map(([c]) => c.slug));

// ---------- Plantilla común ----------
const ICON = {
  company: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3M3 21h18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9" r="2.5" fill="currentColor"/></svg>',
  cal: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  ext: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const HEAD_SCRIPTS = `
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("consent","default",{analytics_storage:"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",wait_for_update:500});try{if(localStorage.getItem("tem:consent")==="si")gtag("consent","update",{analytics_storage:"granted",ad_storage:"granted",ad_user_data:"granted",ad_personalization:"granted"});}catch(e){}</script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6612125908838011" crossorigin="anonymous"></script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-KFSJVX6SV7"></script>
  <script>gtag("js",new Date());gtag("config","G-KFSJVX6SV7");window.track=function(n,p){gtag("event",n,p||{});};</script>`;

function page({ urlPath, title, description, body, ld = [], bodyClass = "" }) {
  const canonical = BASE + urlPath;
  return `<!doctype html>
<html lang="es-CL">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#fbfbfd" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Trabaja en Minería">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${BASE}/media/poster.jpg">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v=20261110">${HEAD_SCRIPTS}
${ld.map((o) => `  <script type="application/ld+json">${jsonLd(o)}</script>`).join("\n")}
</head>
<body class="seo-page ${bodyClass}">
  <a class="skip" href="#contenido">Ir al contenido</a>
  <header class="top">
    <div class="wrap top-inner">
      <a class="brand" href="/" aria-label="Trabaja en Minería, inicio">
        <img src="/logo-mark.svg" width="36" height="36" alt="">
        <span class="word">trabajaen<b>minería</b><i>.cl</i></span>
      </a>
      <nav class="nav">
        <a href="/#ofertas">Ofertas</a>
        <a href="/empleos/">Por región y cargo</a>
        <a href="/recursos/">Recursos</a>
        <a href="/cv.html">CV con IA</a>
        <a href="/empresas.html">Empresas</a>
        <a class="btn btn-sm" href="/#ofertas">Buscar ofertas</a>
      </nav>
    </div>
  </header>
${body}
  <footer class="foot">
    <div class="wrap foot-inner">
      <div>
        <a class="brand" href="/"><img src="/logo-mark.svg" width="28" height="28" alt=""><span class="word">trabajaen<b>minería</b><i>.cl</i></span></a>
        <p>Reunimos ofertas de minería publicadas en portales de empleo de todo Chile. Sin registro: al postular vas directo a la fuente original. Nunca cobramos a los postulantes.</p>
      </div>
      <p class="foot-links"><a href="/#ofertas">Ofertas</a><a href="/empleos/">Por región y cargo</a><a href="/guias.html">Guías</a><a href="/recursos/">Centro de recursos</a><a href="/tutoriales.html">Tutoriales</a><a href="/cv.html">CV con IA</a><a href="/empresas.html">Para empresas</a><a href="/privacidad.html">Privacidad y cookies</a><a href="#" data-cookies>Preferencias de cookies</a><span>© ${updated.getUTCFullYear()} trabajaenmineria.cl</span></p>
    </div>
  </footer>
  <nav class="bottom-nav" aria-label="Navegación principal">
    <a href="/#ofertas"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2"/></svg>Ofertas</a>
    <a href="/empleos/"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9" r="2.5" fill="currentColor"/></svg>Regiones</a>
    <a href="/recursos/"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>Recursos</a>
    <a href="/cv.html"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 3v5h5M10 13h6M10 17h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>CV con IA</a>
  </nav>
  <script src="/config.js"></script>
  <script src="/ads.js"></script>
  <script src="/consent.js"></script>
  <script>
    document.querySelectorAll("[data-postular]").forEach(function (a) {
      a.addEventListener("click", function () { window.track && track("postular", { empresa: a.dataset.empresa || "", fuente: a.dataset.fuente || "", region: a.dataset.region || "", desde: "pagina_oferta" }); });
    });
  </script>
</body>
</html>
`;
}

const crumbs = (items) => `
    <nav class="crumbs" aria-label="Ruta">${items.map(([name, href], i) =>
      href && i < items.length - 1 ? `<a href="${esc(href)}">${esc(name)}</a>` : `<span aria-current="page">${esc(name)}</span>`).join('<span class="sep" aria-hidden="true">›</span>')}</nav>`;

const crumbsLd = (items) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: items.map(([name, href], i) => ({ "@type": "ListItem", position: i + 1, name, ...(href ? { item: BASE + href } : {}) })),
});

function jobCard(j) {
  const initial = (j.company || j._title || "?").trim().charAt(0).toUpperCase();
  const desc = clean(j.description);
  return `
        <li class="job">
          <div class="avatar" aria-hidden="true">${esc(initial)}</div>
          <h3><a href="${esc(j.page)}">${esc(j._title)}</a></h3>
          <div class="meta">
            ${j.company ? `<span>${ICON.company}${esc(j.company)}</span>` : ""}
            ${j.location ? `<span>${ICON.pin}${esc(j.location)}</span>` : ""}
          </div>
          ${desc ? `<p class="desc">${esc(desc.slice(0, 180))}${desc.length > 180 ? "…" : ""}</p>` : ""}
          <div class="tags">${j._cargo ? `<span class="tag tag-shift">Se busca: ${esc(j._cargo.name)}</span>` : ""}${j.region ? `<span class="tag">${esc(j.region)}</span>` : ""}<span>${esc(j.source || "")} · ${fecha(j._date)}</span></div>
        </li>`;
}

const sideCards = (extra = "") => `
      <aside class="side">
        <div class="ad-slot ad-side" data-slot="lateral"><span class="ad-label">Publicidad</span><div class="ad-box" data-size="300 × 250"></div></div>
        ${extra}
        <div class="card card-cta">
          <h3>¿Tu CV está listo?</h3>
          <p>Créalo o mejóralo para el cargo que buscas. Gratis, sin registro y en PDF.</p>
          <a class="btn" href="/cv.html">Crear o mejorar mi CV</a>
        </div>
        <div class="card">
          <h3>Empleos por región</h3>
          <ul class="links">${regionPages.map(([r, l]) => `<li><a href="${regionUrl(r)}">Empleos en ${esc(r)} <small>${l.length}</small></a></li>`).join("")}</ul>
        </div>
        <div class="card">
          <h3>Empleos por cargo</h3>
          <ul class="links">${cargoPages.map(([c, l]) => `<li><a href="/empleos/${c.slug}">${esc(c.plural)} <small>${l.length}</small></a></li>`).join("")}</ul>
        </div>
      </aside>`;

const mirrow = `
        <a class="promo promo-compact" data-mirrow href="https://www.mirrow.cl" target="_blank" rel="noopener sponsored">
          <span class="promo-icon promo-logo" aria-hidden="true"><img src="/media/mirrow-logo.png" width="84" height="80" alt=""></span>
          <span class="promo-text"><small>Recomendado</small><b>Revisa la empresa antes de postular</b><span>Mirrow te ayuda a tomar mejores decisiones, para empresas y personas.</span></span>
        </a>`;

// ---------- Escritura ----------
function write(rel, html) {
  const f = path.join(SITE, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
}
for (const dir of ["oferta", "empleos", "recursos"]) fs.rmSync(path.join(SITE, dir), { recursive: true, force: true });
const RECURSOS_URLS = [];

// 1) Una página por oferta
for (const j of jobs) {
  const desc = clean(j.description);
  const where = [j.location, j.region && j.region !== j.location ? `Región de ${j.region}` : ""].filter(Boolean).join(", ");
  const company = j.company || "";
  const titleTag = `${j._title}${company ? " – " + company : ""}${j.location ? " en " + j.location : ""} | Trabaja en Minería`;
  const metaDesc = `Oferta de empleo en minería: ${j._title}${company ? " en " + company : ""}${where ? ", " + where : ""}. Publicada el ${fecha(j._date)} en ${j.source || "un portal de empleo"}. Postula directo y gratis.`;
  const valid = new Date(j._date.getTime() + 45 * 864e5);
  const expired = valid < updated;

  const related = [
    ...(j._cargo && j.region ? jobs.filter((o) => o !== j && o._cargo === j._cargo && o.region === j.region) : []),
    ...jobs.filter((o) => o !== j && j.region && o.region === j.region),
    ...jobs.filter((o) => o !== j && j._cargo && o._cargo === j._cargo),
  ].filter((o, i, a) => a.indexOf(o) === i).slice(0, 6);

  const trail = [["Inicio", "/"], ["Empleos", "/empleos/"]];
  if (j.region && hasRegionPage.has(j.region)) trail.push([j.region, regionUrl(j.region)]);
  trail.push([j._title, null]);

  const ld = [crumbsLd(trail)];
  if (!expired) {
    ld.push({
      "@context": "https://schema.org/", "@type": "JobPosting",
      title: j._title,
      description: `<p>${esc(desc || j._title)}</p><p>Oferta publicada en ${esc(j.source || "un portal de empleo")}. Para ver el detalle completo y postular, sigue el enlace a la publicación original.</p>`,
      datePosted: j._date.toISOString(),
      validThrough: valid.toISOString(),
      hiringOrganization: { "@type": "Organization", name: company || "Confidencial" },
      jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: j.location || j.region || "Chile", ...(j.region ? { addressRegion: j.region } : {}), addressCountry: "CL" } },
      directApply: false,
      url: BASE + j.page,
    });
  }

  const sourceName = j.source || "la fuente original";
  const body = `
  <div class="wrap">${crumbs(trail)}
    <main class="layout" id="contenido">
      <section>
        <article class="job-detail">
          <span class="eyebrow"><span class="pulse"></span> Oferta de empleo en minería</span>
          <h1>${esc(j._title)}</h1>
          <dl class="facts">
            ${company ? `<div><dt>${ICON.company} Empresa</dt><dd>${esc(company)}</dd></div>` : ""}
            ${where ? `<div><dt>${ICON.pin} Lugar</dt><dd>${esc(where)}</dd></div>` : ""}
            ${j._cargo ? `<div><dt>${ICON.company} Se busca</dt><dd>${hasCargoPage.has(j._cargo.slug) ? `<a href="/empleos/${j._cargo.slug}">${esc(j._cargo.name)}</a>` : esc(j._cargo.name)}</dd></div>` : ""}
            <div><dt>${ICON.cal} Publicada</dt><dd><time datetime="${j._date.toISOString()}">${fecha(j._date)}</time> en ${esc(sourceName)}</dd></div>
          </dl>
          ${desc ? `<h2>Descripción</h2><p class="job-desc">${esc(desc)}</p>` : ""}
          <p class="job-note">Este es un extracto de la oferta publicada en ${esc(sourceName)}. Revisa los requisitos completos, el sueldo y el turno en la publicación original antes de postular.</p>
          <div class="job-apply">
            <a class="btn btn-lg" data-postular data-empresa="${esc(company)}" data-fuente="${esc(j.source || "")}" data-region="${esc(j.region || "")}" href="${esc(j.url)}" target="_blank" rel="noopener nofollow">Postular en ${esc(sourceName)} ${ICON.ext}</a>
            <span>Sin registro en este sitio y sin costo.</span>
          </div>
        </article>
        ${j._cargo ? `
        <div class="job-tips">${perfilHtml(j._cargo)}
          <p class="links-inline">${hasCargoPage.has(j._cargo.slug) ? `<a href="/empleos/${j._cargo.slug}">Ver más ofertas de ${esc(j._cargo.plural.toLowerCase())}</a>` : ""}<a href="/guias.html">Leer las guías para postular</a><a href="/cv.html">Preparar mi CV</a></p>
        </div>` : ""}
        <section class="job-tips job-safe">
          <h2>Postula seguro</h2>
          <p>Ninguna empresa seria cobra por postular, por un curso obligatorio o por "asegurarte el cupo". Desconfía si te piden dinero o datos bancarios antes de un contrato. <a href="/guias.html#guia-estafas">Cómo detectar ofertas falsas</a>.</p>
          ${mirrow}
        </section>
        <div class="ad-slot ad-wide" data-slot="pie"><span class="ad-label">Publicidad</span><div class="ad-box" data-size="728 × 90"></div></div>
        ${related.length ? `
        <section class="related">
          <h2>Ofertas parecidas</h2>
          <ol class="jobs">${related.map(jobCard).join("")}
          </ol>
        </section>` : ""}
      </section>${sideCards()}
    </main>
  </div>`;
  write(`oferta/${j._slug}.html`, page({ urlPath: j.page, title: titleTag, description: metaDesc, body, ld }));
}

// 2) Páginas de región y de cargo
function listPage({ urlPath, h1, lead, intro, list, trail, title, description, extraLinks = "", extraBlock = "" }) {
  const shown = list.slice(0, 120);
  const body = `
  <section class="cv-hero seo-hero">
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="wrap">${crumbs(trail)}
      <span class="eyebrow"><span class="pulse"></span> ${list.length} ofertas · actualizado ${fecha(updated)}</span>
      <h1>${h1}</h1>
      <p class="lead">${esc(lead)}</p>
      <a class="btn btn-lg" href="#contenido">Ver las ofertas</a>
    </div>
  </section>
  <div class="wrap">
    <main class="layout" id="contenido">
      <section>
        <div class="seo-intro">
          <p>${esc(intro)}</p>${extraLinks}
        </div>${extraBlock ? `<div class="job-tips">${extraBlock}</div>` : ""}
        <div class="toolbar"><div><h2>${list.length} ofertas</h2><span class="updated">Las más recientes primero. Se actualizan cada 2 horas.</span></div></div>
        <ol class="jobs">${shown.map(jobCard).join("")}
        </ol>
        ${list.length > shown.length ? `<a class="more" href="/#ofertas">Ver las ${list.length} ofertas en el buscador</a>` : ""}
        <div class="ad-slot ad-wide" data-slot="pie"><span class="ad-label">Publicidad</span><div class="ad-box" data-size="728 × 90"></div></div>
      </section>${sideCards()}
    </main>
  </div>`;
  const ld = [crumbsLd(trail), {
    "@context": "https://schema.org", "@type": "ItemList", name: title,
    itemListElement: shown.slice(0, 30).map((j, i) => ({ "@type": "ListItem", position: i + 1, url: BASE + j.page, name: j._title })),
  }];
  return page({ urlPath, title, description, body, ld });
}

for (const [region, list] of regionPages) {
  const urlPath = regionUrl(region);
  const cargosHere = CARGOS.map((c) => [c, list.filter((j) => j._cargo === c).length]).filter(([, n]) => n > 0);
  const extra = cargosHere.length ? `<p class="links-inline">${cargosHere.map(([c, n]) => hasCargoPage.has(c.slug) ? `<a href="/empleos/${c.slug}">${esc(c.plural)} (${n})</a>` : "").join("")}</p>` : "";
  write(`empleos/${slugify(region)}.html`, listPage({
    urlPath, list,
    title: `Trabajo en minería en ${region}: ${list.length} ofertas | Trabaja en Minería`,
    description: `${list.length} ofertas de trabajo en minería en la región de ${region}, actualizadas cada 2 horas: operadores, mantenedores, eléctricos, conductores y más. Postula directo y sin registro.`,
    h1: `Trabajo en minería en <span class="grad">${esc(region)}.</span>`,
    lead: `${list.length} ofertas de empleo minero en la región de ${region}, de faenas, contratistas y proveedores. Postula directo, sin registro y sin costo.`,
    intro: REGIONES[region],
    trail: [["Inicio", "/"], ["Empleos", "/empleos/"], [region, null]],
    extraLinks: extra,
  }));
}

for (const [c, list] of cargoPages) {
  const regionsHere = regionPages.map(([r]) => [r, list.filter((j) => j.region === r).length]).filter(([, n]) => n > 0);
  const extra = regionsHere.length ? `<p class="links-inline">${regionsHere.map(([r, n]) => `<a href="${regionUrl(r)}">${esc(r)} (${n})</a>`).join("")}</p>` : "";
  write(`empleos/${c.slug}.html`, listPage({
    urlPath: `/empleos/${c.slug}`, list,
    title: `Trabajo de ${c.name.toLowerCase()} en minería: ${list.length} ofertas | Trabaja en Minería`,
    description: `${list.length} ofertas de trabajo para ${c.plural.toLowerCase()} en la minería de Chile, actualizadas cada 2 horas. Requisitos habituales, consejos y postulación directa sin registro.`,
    h1: `Empleos de ${esc(c.name.toLowerCase())} <span class="grad">en minería.</span>`,
    lead: `${list.length} ofertas para ${c.plural.toLowerCase()} en faenas y contratistas de todo Chile. Postula directo, sin registro y sin costo.`,
    intro: c.intro,
    trail: [["Inicio", "/"], ["Empleos", "/empleos/"], [c.plural, null]],
    extraLinks: extra,
    extraBlock: perfilHtml(c),
  }));
}

// 3) Índice /empleos/
{
  const trail = [["Inicio", "/"], ["Empleos", null]];
  const body = `
  <section class="cv-hero seo-hero">
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="wrap">${crumbs(trail)}
      <span class="eyebrow"><span class="pulse"></span> ${jobs.length} ofertas · actualizado ${fecha(updated)}</span>
      <h1>Empleos en minería <span class="grad">por región y cargo.</span></h1>
      <p class="lead">Elige tu región o tu especialidad y revisa las ofertas de faenas, contratistas y proveedores de todo Chile.</p>
    </div>
  </section>
  <main class="wrap guides" id="contenido">
    <section>
      <div class="sec-head"><h2>Por región</h2><p>Antofagasta, Atacama, Tarapacá y Coquimbo concentran la mayor parte del empleo minero del país.</p></div>
      <ul class="hub-grid">${regionPages.map(([r, l]) => `
        <li><a href="${regionUrl(r)}"><b>${esc(r)}</b><span>${l.length} ofertas</span></a></li>`).join("")}
      </ul>
    </section>
    <div class="ad-slot ad-wide" data-slot="guias"><span class="ad-label">Publicidad</span><div class="ad-box" data-size="728 × 90"></div></div>
    <section>
      <div class="sec-head"><h2>Por cargo</h2><p>Operadores y mantenedores son los perfiles más buscados de la gran minería.</p></div>
      <ul class="hub-grid">${cargoPages.map(([c, l]) => `
        <li><a href="/empleos/${c.slug}"><b>${esc(c.plural)}</b><span>${l.length} ofertas</span></a></li>`).join("")}
      </ul>
    </section>
  </main>`;
  write("empleos/index.html", page({
    urlPath: "/empleos/",
    title: "Empleos en minería por región y cargo | Trabaja en Minería",
    description: `${jobs.length} ofertas de trabajo en minería en Chile ordenadas por región (Antofagasta, Atacama, Tarapacá, Coquimbo y más) y por cargo (operadores, mantenedores, eléctricos, conductores y más).`,
    body, ld: [crumbsLd([["Inicio", "/"], ["Empleos", null]])],
  }));
}

// 3b) Centro de recursos: una ficha por cargo (perfil, formación, competencias, ruta y ofertas del día)
// Texto propio y general: orienta, pero cada oferta manda en sus requisitos exactos.
const FICHAS = {
  "operador-de-equipos": {
    formacion: ["Curso de operación del equipo (camión, cargador, bulldozer, grúa, etc.) en una OTEC reconocida.", "Licencia profesional A4/A5 para camiones o clase D para maquinaria.", "Inducción de seguridad minera y curso de manejo a la defensiva.", "Muchas mineras tienen programas de formación de operadores que pagan el curso a quienes seleccionan."],
    competencias: ["Concentración durante turnos largos.", "Respeto estricto de las reglas de tránsito en faena.", "Cuidado del equipo y reporte oportuno de fallas.", "Trabajo coordinado por radio con despacho y otros operadores."],
    ruta: ["Ayudante o conductor de apoyo", "Operador de equipo auxiliar", "Operador de equipo de extracción", "Operador líder o instructor", "Supervisor de operaciones"],
    entorno: "Trabaja en la mina rajo abierto o subterránea, o en la planta, normalmente en sistemas de turnos como 7x7 o 4x3, con alojamiento en campamento cuando la faena es remota.",
  },
  "mantenedor-mecanico": {
    formacion: ["Título técnico de nivel medio o superior en mecánica industrial, automotriz o de equipo pesado.", "Cursos de los fabricantes (motores, transmisiones, hidráulica) de los equipos que se mantienen.", "Bloqueo y aislación de energías, trabajo en altura y rigging, según el puesto.", "Certificaciones de soldadura o neumática suman en mantención de planta."],
    competencias: ["Diagnóstico ordenado de fallas.", "Lectura de manuales, planos y pautas de mantención.", "Trabajo en equipo bajo presión para devolver equipos a operación.", "Registro preciso del trabajo realizado."],
    ruta: ["Ayudante mecánico", "Mecánico", "Mantenedor especialista", "Planificador o líder de mantención", "Supervisor o jefe de mantenimiento"],
    entorno: "Trabaja en talleres de camiones, en terreno junto a los equipos o en la planta de procesos, con turnos rotativos y tareas programadas y de emergencia.",
  },
  "electrico-e-instrumentista": {
    formacion: ["Título técnico o profesional en electricidad, electromecánica, electrónica o instrumentación.", "Licencia SEC acorde al tipo de instalación.", "Cursos de autómatas programables (PLC), variadores y sistemas de control.", "Bloqueo de energías y trabajo con alta tensión, según el puesto."],
    competencias: ["Rigurosidad con los procedimientos de seguridad eléctrica.", "Lectura de diagramas unilineales y de control.", "Uso de instrumentos de medición y calibración.", "Capacidad para aprender sistemas automatizados nuevos."],
    ruta: ["Ayudante eléctrico", "Eléctrico o instrumentista", "Especialista en control o automatización", "Supervisor eléctrico", "Ingeniero o jefe de área"],
    entorno: "Trabaja en subestaciones, salas eléctricas, planta concentradora, chancado y equipos móviles, en turnos y con guardias para emergencias.",
  },
  "conductor-y-chofer": {
    formacion: ["Licencia profesional vigente (A2 para transporte de personas, A4/A5 para carga).", "Curso de manejo a la defensiva y, en faena, curso de conducción en camino minero.", "Para cargas peligrosas, curso y habilitación específica.", "Exámenes psicosensotécnicos al día."],
    competencias: ["Conducción segura en caminos de altura y de ripio.", "Puntualidad y responsabilidad con horarios de traslado.", "Revisión diaria del vehículo.", "Buen trato con los pasajeros."],
    ruta: ["Conductor de camioneta o apoyo", "Conductor de bus de personal o camión", "Conductor de carga especial", "Coordinador de transporte", "Jefe de flota"],
    entorno: "Recorre los tramos entre ciudad, campamento y faena, o caminos internos de la mina, con turnos y descansos regulados.",
  },
  "prevencionista-de-riesgos": {
    formacion: ["Título de técnico o ingeniero en prevención de riesgos.", "Registro vigente como experto en la SEREMI de Salud.", "Conocimiento del Reglamento de Seguridad Minera (DS 132) y de la Ley 16.744.", "Cursos de investigación de accidentes y sistemas de gestión (ISO 45001)."],
    competencias: ["Liderazgo para promover conductas seguras.", "Capacidad de observar y detener trabajos inseguros.", "Redacción clara de informes y procedimientos.", "Capacitación de equipos en terreno."],
    ruta: ["Asistente de prevención", "Prevencionista de contrato", "Prevencionista senior o de área", "Jefe de prevención", "Gerente de seguridad y salud"],
    entorno: "Trabaja en terreno junto a las cuadrillas y en oficina, revisando permisos, charlas, inspecciones y la documentación que exige la mandante.",
  },
  "supervisor-y-jefatura": {
    formacion: ["Título técnico o profesional en el área que supervisa.", "Experiencia previa como operador, mantenedor o especialista.", "Cursos de liderazgo, gestión de equipos y planificación.", "Conocimiento de la normativa de seguridad y del contrato."],
    competencias: ["Liderazgo y comunicación con la cuadrilla.", "Toma de decisiones con información incompleta.", "Control de avance, costos y calidad.", "Coordinación con la mandante y otras áreas."],
    ruta: ["Trabajador con experiencia", "Capataz o líder de turno", "Supervisor", "Jefe de turno o de área", "Administrador de contrato o superintendente"],
    entorno: "Reparte su tiempo entre terreno y oficina, con turnos y responsabilidad por personas, equipos y resultados.",
  },
  "ingeniero": {
    formacion: ["Título de ingeniería civil o de ejecución en minas, metalurgia, mecánica, eléctrica, química o industrial.", "Software de planificación, simulación o análisis de datos según el área.", "Inglés técnico, muy valorado en grandes mineras.", "Postítulos en gestión de activos, proyectos o confiabilidad."],
    competencias: ["Análisis de datos y resolución de problemas.", "Comunicación con equipos de terreno.", "Gestión de proyectos y contratistas.", "Visión de seguridad, costos y productividad."],
    ruta: ["Ingeniero en práctica o trainee", "Ingeniero junior", "Ingeniero senior o especialista", "Jefe de unidad", "Superintendente o gerente"],
    entorno: "Trabaja en faena y en oficinas centrales, con turnos en faena o jornada en ciudad según el cargo.",
  },
  "geologo-y-topografo": {
    formacion: ["Título de geólogo, técnico en geología, topógrafo o ingeniero en geomensura.", "Manejo de estación total, GPS de precisión y drones, en topografía.", "Software de modelamiento geológico y de planificación minera.", "Cursos de muestreo y control de calidad de muestras."],
    competencias: ["Precisión en mediciones y registros.", "Trabajo en terreno en condiciones exigentes.", "Interpretación de planos y modelos 3D.", "Orden con la información y los datos."],
    ruta: ["Ayudante de topografía o muestrero", "Topógrafo o geólogo de terreno", "Geólogo de modelamiento o topógrafo senior", "Jefe de geología o topografía", "Superintendente de geología"],
    entorno: "Trabaja en la mina, en exploración y en sondajes, muchas veces en zonas remotas y de altura, con turnos.",
  },
  "soldador": {
    formacion: ["Curso de soldadura en una OTEC o liceo técnico.", "Certificación vigente según proceso (SMAW, GMAW, FCAW, TIG) y posición.", "Trabajo en caliente, trabajo en altura y espacios confinados.", "Lectura de planos de estructuras y piping."],
    competencias: ["Precisión y calidad en cada cordón.", "Seguridad con permisos de trabajo en caliente.", "Trabajo en equipo con mecánicos y montajistas.", "Paciencia para trabajos de reparación detallados."],
    ruta: ["Ayudante de soldador", "Soldador", "Soldador calificado", "Maestro mayor o capataz", "Supervisor de montaje o mantención"],
    entorno: "Trabaja en talleres, plantas y proyectos de construcción o mantención mayor (paradas de planta), con turnos intensivos.",
  },
  "bodega-y-logistica": {
    formacion: ["Enseñanza media o título técnico en logística, administración o comercio.", "Licencia de grúa horquilla (clase D) para mover carga.", "Manejo de SAP u otros sistemas de inventario.", "Cursos de almacenamiento de sustancias peligrosas, según la bodega."],
    competencias: ["Orden y exactitud con los registros.", "Planificación de despachos y stock.", "Atención a las áreas que piden repuestos.", "Seguridad en el manejo de carga."],
    ruta: ["Ayudante de bodega", "Bodeguero u operador de grúa horquilla", "Encargado de bodega o inventario", "Comprador o planificador de abastecimiento", "Jefe de logística"],
    entorno: "Trabaja en bodegas de faena o de la ciudad, coordinando con compras, mantención y transporte.",
  },
  "administrativo": {
    formacion: ["Título técnico o profesional en administración, contabilidad, recursos humanos o similar.", "Excel intermedio o avanzado.", "Manejo de SAP u otros sistemas de gestión.", "Conocimiento de legislación laboral, para cargos de personas."],
    competencias: ["Organización y cumplimiento de plazos.", "Atención clara a trabajadores y proveedores.", "Confidencialidad con la información.", "Trabajo con documentos y controles."],
    ruta: ["Asistente administrativo", "Administrativo de faena o contrato", "Analista", "Jefe administrativo o de personas", "Gerente de administración"],
    entorno: "Trabaja en oficinas de la ciudad o de la faena; en faena suele haber turnos y apoyo directo a la operación.",
  },
  "sin-experiencia": {
    formacion: ["Enseñanza media completa abre la mayoría de las puertas.", "Cursos cortos: inducción de seguridad minera, primeros auxilios, trabajo en altura.", "Licencia de conducir (B, y luego D o A4) amplía mucho las opciones.", "Programas de formación de mineras y becas de capacitación para personas sin experiencia."],
    competencias: ["Ganas de aprender y buena disposición.", "Puntualidad y responsabilidad.", "Respeto por las normas de seguridad.", "Adaptación a turnos y a vivir en campamento."],
    ruta: ["Ayudante, auxiliar o servicios en faena", "Ayudante especializado (mecánico, eléctrico, soldador)", "Operador o técnico", "Especialista", "Supervisor"],
    entorno: "Muchas personas empiezan en servicios (alimentación, aseo, vigilancia) o como ayudantes en empresas contratistas, y desde ahí se capacitan para otros cargos.",
  },
};

{
  const fichas = CARGOS.filter((c) => PERFILES[c.slug] && FICHAS[c.slug]);
  const trail0 = [["Inicio", "/"], ["Centro de recursos", null]];
  for (const c of fichas) {
    const p = PERFILES[c.slug], f = FICHAS[c.slug];
    const list = byCargo.get(c.slug) || [];
    const urlPath = `/recursos/${c.slug}`;
    const trail = [["Inicio", "/"], ["Centro de recursos", "/recursos/"], [c.name, null]];
    const li = (arr) => arr.map((t) => `<li>${esc(t)}</li>`).join("");
    const body = `
  <div class="wrap">${crumbs(trail)}
    <main class="layout" id="contenido">
      <section>
        <article class="job-detail ficha">
          <span class="eyebrow"><span class="pulse"></span> Perfil de cargo minero</span>
          <h1>${esc(c.name)}</h1>
          <p class="lead-left">${esc(c.intro)}</p>
          <div class="ficha-actions no-print">
            ${hasCargoPage.has(c.slug) ? `<a class="btn" href="/empleos/${c.slug}">Ver ${list.length} ofertas</a>` : ""}
            <button class="btn btn-ghost" type="button" onclick="window.track&&track('descargar_ficha',{cargo:'${c.slug}'});print()">Guardar ficha en PDF</button>
          </div>
          <h2>Dónde y cómo trabaja</h2>
          <p>${esc(f.entorno)}</p>
          <div class="perfil-grid">
            <div><h3>Qué hace</h3><ul>${li(p.hace)}</ul></div>
            <div><h3>Qué suelen pedir</h3><ul>${li(p.pide)}</ul></div>
            <div><h3>Formación y certificaciones</h3><ul>${li(f.formacion)}</ul></div>
            <div><h3>Competencias que se valoran</h3><ul>${li(f.competencias)}</ul></div>
          </div>
          <h2>Ruta de crecimiento</h2>
          <ol class="ruta">${f.ruta.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>
          <p class="perfil-tip"><b>Consejo para postular:</b> ${esc(c.tip)}</p>
          <p class="perfil-note">Ficha orientativa elaborada por trabajaenmineria.cl. Los requisitos exactos los define cada empresa en su oferta.</p>
        </article>
        ${list.length ? `
        <section class="related no-print">
          <h2>Ofertas de ${esc(c.plural.toLowerCase())} hoy</h2>
          <ol class="jobs">${list.slice(0, 5).map(jobCard).join("")}
          </ol>
          ${hasCargoPage.has(c.slug) ? `<a class="more" href="/empleos/${c.slug}">Ver las ${list.length} ofertas</a>` : ""}
        </section>` : ""}
      </section>
      <aside class="side no-print">
        <div class="card card-cta">
          <h3>Arma tu CV para este cargo</h3>
          <p>Gratis, sin registro y con sugerencias de palabras clave para ${esc(c.name.toLowerCase())}.</p>
          <a class="btn" href="/cv.html">Crear mi CV</a>
        </div>
        <div class="card">
          <h3>Otros perfiles</h3>
          <ul class="links">${fichas.filter((o) => o !== c).map((o) => `<li><a href="/recursos/${o.slug}">${esc(o.name)}</a></li>`).join("")}</ul>
        </div>
        <div class="card">
          <h3>Aprende a usar el sitio</h3>
          <p>Videos cortos para buscar, postular y armar tu CV.</p>
          <a class="more share-li" href="/tutoriales.html">Ver tutoriales</a>
        </div>
      </aside>
    </main>
  </div>`;
    const ld = [crumbsLd(trail), {
      "@context": "https://schema.org", "@type": "Occupation", name: c.name,
      description: c.intro, occupationLocation: { "@type": "Country", name: "Chile" },
      skills: f.competencias.join(" "), qualifications: p.pide.join(" "),
    }];
    write(`recursos/${c.slug}.html`, page({
      urlPath, ld,
      title: `${c.name} en minería: qué hace, requisitos y formación | Trabaja en Minería`,
      description: `Perfil del cargo ${c.name.toLowerCase()} en minería: funciones, requisitos habituales, cursos y certificaciones, competencias y ruta de crecimiento. Con ofertas del día.`,
      body,
    }));
  }

  // Índice del centro de recursos
  const body = `
  <section class="cv-hero seo-hero">
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="wrap">${crumbs(trail0)}
      <span class="eyebrow"><span class="pulse"></span> ${fichas.length} perfiles de cargo · gratis</span>
      <h1>Centro de recursos <span class="grad">para trabajar en minería.</span></h1>
      <p class="lead">Fichas de cada cargo con lo que hace, lo que piden y cómo prepararte. Además, guías y videos para postular mejor.</p>
      <label class="res-search no-print"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="res-q" type="search" placeholder="Busca un cargo: operador, eléctrico, soldador…" aria-label="Buscar perfil de cargo"></label>
    </div>
  </section>
  <main class="wrap guides" id="contenido">
    <section>
      <div class="sec-head"><h2>Perfiles de cargo</h2><p>Funciones, requisitos habituales, formación, competencias y ruta de crecimiento de los cargos más buscados.</p></div>
      <ul class="res-grid" id="res-grid">${fichas.map((c) => `
        <li data-q="${esc(norm(c.name + " " + c.plural + " " + c.intro))}"><a href="/recursos/${c.slug}">
          <small>Perfil de cargo</small><b>${esc(c.name)}</b><span>${esc(c.intro.split(". ")[0])}.</span>
          <em>${(byCargo.get(c.slug) || []).length} ofertas hoy</em></a></li>`).join("")}
      </ul>
      <p class="res-empty" id="res-empty" hidden>No encontramos ese cargo. Prueba con otra palabra o revisa <a href="/empleos/">todas las ofertas por cargo</a>.</p>
    </section>
    <section>
      <div class="sec-head"><h2>Más recursos</h2></div>
      <ul class="hub-grid">
        <li><a href="/tutoriales.html"><b>Videos tutoriales</b><span>Busca, postula y arma tu CV</span></a></li>
        <li><a href="/guias.html"><b>Guías y noticias</b><span>Turnos, licencias, exámenes</span></a></li>
        <li><a href="/cv.html"><b>CV para minería</b><span>Gratis y sin registro</span></a></li>
        <li><a href="/guias.html#guia-estafas"><b>Ofertas falsas</b><span>Cómo reconocerlas</span></a></li>
      </ul>
    </section>
  </main>
  <script>
    (function () {
      var q = document.getElementById("res-q"), items = document.querySelectorAll("#res-grid li"), empty = document.getElementById("res-empty");
      var norm = function (s) { return s.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase(); };
      q.addEventListener("input", function () {
        var t = norm(q.value.trim()).split(/\\s+/).filter(Boolean), n = 0;
        items.forEach(function (li) { var ok = t.every(function (w) { return li.dataset.q.indexOf(w) >= 0; }); li.hidden = !ok; if (ok) n++; });
        empty.hidden = n > 0;
      });
    })();
  </script>`;
  write("recursos/index.html", page({
    urlPath: "/recursos/",
    title: "Centro de recursos: perfiles de cargos mineros | Trabaja en Minería",
    description: "Perfiles de los cargos más buscados en minería: operador, mantenedor, eléctrico, conductor, prevencionista, soldador y más. Funciones, requisitos, formación y ruta de crecimiento.",
    body, ld: [crumbsLd([["Inicio", "/"], ["Centro de recursos", null]])],
  }));
  RECURSOS_URLS.push(`${BASE}/recursos/`, ...fichas.map((c) => `${BASE}/recursos/${c.slug}`));
}

// 4) jobs.json con el campo "page" (para que el buscador enlace a cada oferta)
// También el cargo detectado ("Se busca: …"), para mostrarlo y enlazarlo en el buscador
const out = { ...data, jobs: (data.jobs || []).map((j) => {
  const { _slug, _title, _date, _cargo, ...rest } = j;
  if (_cargo) rest.cargo = { slug: _cargo.slug, name: _cargo.name, page: hasCargoPage.has(_cargo.slug) };
  return rest;
}) };
fs.writeFileSync(jobsPath, JSON.stringify(out, null, 0));

// 5) sitemap.xml
const today = isoDay(updated);
const urls = [
  [`${BASE}/`, today, "hourly", "1.0"],
  [`${BASE}/empleos/`, today, "hourly", "0.9"],
  ...regionPages.map(([r]) => [BASE + regionUrl(r), today, "hourly", "0.8"]),
  ...cargoPages.map(([c]) => [`${BASE}/empleos/${c.slug}`, today, "hourly", "0.8"]),
  [`${BASE}/guias.html`, null, "weekly", "0.7"],
  [`${BASE}/cv.html`, null, "monthly", "0.6"],
  [`${BASE}/empresas.html`, null, "monthly", "0.5"],
  [`${BASE}/tutoriales.html`, null, "monthly", "0.6"],
  ...RECURSOS_URLS.map((u) => [u, today, "weekly", "0.7"]),
  [`${BASE}/privacidad.html`, null, "yearly", "0.2"],
  ...jobs.map((j) => [BASE + j.page, isoDay(j._date), "weekly", "0.5"]),
];
fs.writeFileSync(path.join(SITE, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([loc, mod, freq, pr]) => `  <url><loc>${esc(loc)}</loc>${mod ? `<lastmod>${mod}</lastmod>` : ""}<changefreq>${freq}</changefreq><priority>${pr}</priority></url>`).join("\n")}
</urlset>
`);

console.log(`Páginas generadas: ${jobs.length} ofertas, ${regionPages.length} regiones, ${cargoPages.length} cargos, 1 índice. Sitemap: ${urls.length} URLs.`);
