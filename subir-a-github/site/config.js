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
};
