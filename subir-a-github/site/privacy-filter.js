// Quita datos personales (nombre, RUT, teléfono, dirección, correo y similares) de un texto
// antes de enviarlo a la IA. Se ejecuta en el navegador: esos datos nunca salen del equipo.
(function (global) {
  const LABELS = "nombre(?: completo)?|rut|run|c[ée]dula(?: de identidad)?|tel[ée]fono|fono|celular|m[óo]vil|whatsapp|correo(?: electr[óo]nico)?|e-?mail|mail|direcci[óo]n|domicilio|fecha de nacimiento|edad|estado civil|nacionalidad|linkedin";
  const RULES = [
    // Línea con etiqueta: "Teléfono: +56 9 ..." → se conserva la etiqueta, se quita el dato
    ["etiqueta", new RegExp(`^(\\s*(${LABELS})\\s*[:\\-–])[^\\n]*$`, "gim"), (m, keep) => keep + " [dato personal omitido]"],
    ["correo", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => "[correo]"],
    ["otros datos", /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/\S*/gi, () => "[linkedin]"],
    ["RUT", /\b\d{1,2}\.?\d{3}\.?\d{3}\s*-\s*[\dkK]\b/g, () => "[RUT]"],
    ["teléfono", /\+?\s?56[\s.-]*\(?\d{1,2}\)?[\s.-]*\d{3,4}[\s.-]*\d{4}\b/g, () => "[teléfono]"],
    ["teléfono", /\b9[\s.-]?\d{4}[\s.-]?\d{4}\b/g, () => "[teléfono]"],
    ["dirección", /^[^\n]*\b(?:calle|avenida|av\.|pasaje|psje\.?|villa|poblaci[óo]n|depto\.?|departamento|condominio|block)\b[^\n]*\d[^\n]*$/gim, () => "[dirección]"],
  ];
  const HEADINGS = /^(curr[íi]cul(um|o)( vitae)?|cv|hoja de vida|antecedentes personales|datos personales)$/i;

  function labelKind(label) {
    const l = label.toLowerCase();
    if (/^nombre/.test(l)) return "nombre";
    if (/^(rut|run|c[ée]dula)/.test(l)) return "RUT";
    if (/^(tel|fono|celular|m[óo]vil|whatsapp)/.test(l)) return "teléfono";
    if (/(correo|mail)/.test(l)) return "correo";
    if (/^(direcci|domicilio)/.test(l)) return "dirección";
    return "otros datos";
  }

  // En un CV subido, el nombre suele ser la primera línea: 2 a 5 palabras con mayúscula inicial, solo letras
  function guessName(text) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4);
    for (const l of lines) {
      if (HEADINGS.test(l)) continue;
      const words = l.split(/\s+/);
      const ok = words.length >= 2 && words.length <= 5 && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/.test(l) && words.every((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w));
      return ok ? l : null;
    }
    return null;
  }

  // opts.guessName: intentar detectar el nombre (CV subido); opts.names: nombres conocidos a quitar
  function redact(input, opts = {}) {
    let text = String(input || "");
    const found = new Set();
    const names = (opts.names || []).filter((n) => n && n.trim().length > 2);
    if (opts.guessName) { const g = guessName(text); if (g) names.push(g); }
    for (const n of names) {
      if (text.includes(n.trim())) { text = text.split(n.trim()).join("[nombre]"); found.add("nombre"); }
    }
    for (const [kind, re, rep] of RULES) {
      text = text.replace(re, (m, keep, label) => { found.add(kind === "etiqueta" ? labelKind(label) : kind); return rep(m, keep); });
    }
    return { text, found: [...found] };
  }

  // Aplica el filtro a todos los textos de un objeto (por ejemplo, el CV del creador)
  function redactDeep(value, opts = {}, found = new Set()) {
    if (typeof value === "string") { const r = redact(value, opts); r.found.forEach((f) => found.add(f)); return r.text; }
    if (Array.isArray(value)) return value.map((v) => redactDeep(v, opts, found));
    if (value && typeof value === "object") {
      const out = {};
      for (const k of Object.keys(value)) out[k] = redactDeep(value[k], opts, found);
      return out;
    }
    return value;
  }

  global.PrivacyFilter = { redact, redactDeep };
})(window);
