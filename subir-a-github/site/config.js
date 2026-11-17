// Configuración del sitio.
// Con Netlify (repo conectado) o GitHub Pages no hace falta cambiar nada.
// Para Netlify Drop, scripts/build-netlify-drop.ps1 genera una versión de este archivo con tus URLs.
window.TEM_CONFIG = {
  // De dónde se leen las ofertas. Puede ser la URL "raw" de GitHub del jobs.json que actualiza el workflow.
  jobsUrl: "data/jobs.json",
  // Dónde responde la IA del CV. Vacío = sin IA (el creador y las descargas Word/PDF siguen funcionando).
  cvApiUrl: "/api/cv",
  // Corrector del CV: "local" = reglas de reclutamiento minero en el navegador (no usa la consola de Claude);
  // "ia" = usa cvApiUrl con Claude (requiere ANTHROPIC_API_KEY en Netlify; si falla, vuelve a "local").
  cvMotor: "local",
  // Tu ID de editor de AdSense (ca-pub-...). Vacío = los espacios de publicidad no se muestran.
  // Si lo cambias, cámbialo también en el <head> de index.html, cv.html y privacidad.html, y en ads.txt.
  adClient: "ca-pub-6612125908838011",
  // ID de cada bloque de anuncios creado en AdSense (Anuncios > Por bloque de anuncios).
  // Un espacio sin ID no se muestra. Para ver dónde irán: abre el sitio con ?ver-anuncios
  adSlots: {
    lateral: "",  // columna derecha de las ofertas (300×250)
    listado: "",  // entre las ofertas, con el mismo formato de una oferta (In-feed)
    pie: "",      // al final del listado (horizontal)
    cv: "",       // página del CV
    guias: "",    // página de guías y noticias
  },
  // Clave de diseño del anuncio In-feed (AdSense la entrega al crear el bloque "listado")
  adLayoutKey: "",
  // Enlace del banner de Mirrow
  mirrowUrl: "https://www.mirrow.cl",
  // Correo de contacto para empresas (página empresas.html). Vacío = el botón de correo no se muestra.
  contactoEmpresas: "",
  // Si no hay correo, las empresas escriben por mensaje directo a esta cuenta de Instagram (sin @). Vacío = sin botón.
  contactoInstagram: "trabajaenmineriacl",
  // Espacios sin vender muestran un aviso "Anúnciate aquí" que lleva a empresas.html#anunciar. false = no se muestran.
  anunciateAqui: true,
  // Patrocinios vendidos directo. Cada uno aparece en los espacios indicados (lateral, listado, pie, cv, guias)
  // y tiene prioridad sobre AdSense. Fechas en formato AAAA-MM-DD; fuera de esas fechas no se muestra.
  // Los clics se miden en Analytics como "click_patrocinio" y el enlace lleva UTM (utm_medium=patrocinio).
  // Ejemplo (copiar, completar y quitar las barras //):
  // { nombre: "OTEC Ejemplo", categoria: "Capacitación", titulo: "Curso de operador de cargador frontal",
  //   texto: "Clases en Antofagasta y Calama. Certificación incluida.", cta: "Ver curso",
  //   url: "https://www.ejemplo.cl/curso", logo: "/media/patrocinio-ejemplo.png",
  //   espacios: ["lateral", "pie"], desde: "2026-12-01", hasta: "2026-12-31" },
  patrocinios: [],
  // Cursos de OTEC y escuelas asociadas (página /cursos, guías y perfiles de cargo), con enlace de referido.
  // categoria: licencias | seguridad | oficios | seguridad-privada | mineria
  // cargos (opcional): perfiles donde también aparece (operador-de-equipos, conductor-y-chofer, sin-experiencia…)
  // Los clics se miden en Analytics como "click_curso" y el enlace lleva UTM (utm_medium=referido).
  // Ejemplo (copiar, completar y quitar las barras //):
  // { otec: "Escuela Ejemplo", nombre: "Licencia clase D", categoria: "licencias", cargos: ["operador-de-equipos"],
  //   url: "https://www.ejemplo.cl/licencia-d?ref=tem", modalidad: "Presencial", ciudad: "Antofagasta",
  //   duracion: "3 semanas", precio: "$250.000", sence: "", logo: "", desde: "", hasta: "" },
  cursos: [],
};
