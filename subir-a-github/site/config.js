// Configuración del sitio.
// Con Netlify (repo conectado) o GitHub Pages no hace falta cambiar nada.
// Para Netlify Drop, scripts/build-netlify-drop.ps1 genera una versión de este archivo con tus URLs.
window.TEM_CONFIG = {
  // De dónde se leen las ofertas. Puede ser la URL "raw" de GitHub del jobs.json que actualiza el workflow.
  jobsUrl: "data/jobs.json",
  // Dónde responde la IA del CV. Vacío = sin IA (el creador y las descargas Word/PDF siguen funcionando).
  cvApiUrl: "/api/cv",
};
