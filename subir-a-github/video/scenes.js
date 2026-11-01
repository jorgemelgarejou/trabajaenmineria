// Escenas del video explicativo, dibujadas en canvas 1280x720.
// drawFrame(ctx, t, timeline) pinta el cuadro del segundo t. Lo usa render.html para generar el MP4.
(function (global) {
  const W = 1280, H = 720;
  const C = { bg: "#0b0e12", bg2: "#10151a", surface: "#141a20", surface2: "#1a2129", ink: "#eeebe5", muted: "#98a2ad",
              copper: "#d98a3d", copper2: "#f3b46a", copper3: "#a85a22", light: "#f6c27d", ok: "#4cc4a3" };
  const DISPLAY = "Sora", BODY = "Inter";

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeIO = (t) => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (p, a, b) => clamp((p - a) / (b - a)); // progreso local entre a y b
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hexMix(a, b, t) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return "rgb(" + pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(",") + ")";
  }
  function copperGrad(ctx, x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, C.light); g.addColorStop(.55, C.copper); g.addColorStop(1, C.copper3);
    return g;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function font(w, s, f = BODY) { return `${w} ${s}px "${f}"`; }

  // ---------- Elementos de marca ----------
  const MARK_PTS = [[9, 27], [17, 27], [17, 35], [24, 35], [24, 43], [40, 43], [40, 35], [47, 35], [47, 27], [55, 27]];
  function drawMark(ctx, cx, cy, size, prog = 1, alpha = 1) {
    const s = size / 64, x0 = cx - size / 2, y0 = cy - size / 2;
    ctx.save(); ctx.globalAlpha *= alpha;
    const bg = ctx.createLinearGradient(x0, y0, x0 + size, y0 + size);
    bg.addColorStop(0, "#1c232b"); bg.addColorStop(1, "#0b0e12");
    rr(ctx, x0, y0, size, size, 16 * s); ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.lineWidth = 1.5 * s; ctx.stroke();
    // sol / lámpara
    const sp = ease(seg(prog, .55, 1));
    const sx = x0 + 46 * s, sy = y0 + 15 * s;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 10 * s);
    sg.addColorStop(0, `rgba(255,226,176,${sp})`); sg.addColorStop(.45, `rgba(243,180,106,${sp * .9})`); sg.addColorStop(1, "rgba(243,180,106,0)");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 10 * s, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,233,196,${sp})`; ctx.beginPath(); ctx.arc(sx, sy, 4.2 * s, 0, 7); ctx.fill();
    // terrazas (se dibujan según prog)
    const lp = ease(seg(prog, 0, .7));
    const segs = []; let total = 0;
    for (let i = 1; i < MARK_PTS.length; i++) { const [ax, ay] = MARK_PTS[i - 1], [bx, by] = MARK_PTS[i]; const l = Math.hypot(bx - ax, by - ay); segs.push([ax, ay, bx, by, l]); total += l; }
    let left = total * lp;
    ctx.beginPath(); ctx.moveTo(x0 + MARK_PTS[0][0] * s, y0 + MARK_PTS[0][1] * s);
    for (const [ax, ay, bx, by, l] of segs) {
      if (left <= 0) break;
      const k = Math.min(1, left / l);
      ctx.lineTo(x0 + lerp(ax, bx, k) * s, y0 + lerp(ay, by, k) * s);
      left -= l;
    }
    ctx.strokeStyle = copperGrad(ctx, x0, y0, x0 + size, y0 + size);
    ctx.lineWidth = 4.2 * s; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    ctx.restore();
  }
  function drawWordmark(ctx, x, y, size, alpha = 1, align = "left") {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.textBaseline = "middle";
    const parts = [["trabajaen", font(500, size, DISPLAY), C.ink], ["minería", font(700, size, DISPLAY), "grad"], [".cl", font(500, size * .82, DISPLAY), C.muted]];
    let total = 0; for (const [t, f] of parts) { ctx.font = f; total += ctx.measureText(t).width; }
    let cx = align === "center" ? x - total / 2 : x;
    for (const [t, f, col] of parts) {
      ctx.font = f; const w = ctx.measureText(t).width;
      ctx.fillStyle = col === "grad" ? copperGrad(ctx, cx, y - size / 2, cx + w, y + size / 2) : col;
      ctx.fillText(t, cx, y); cx += w;
    }
    ctx.restore();
  }

  // ---------- Rodrigo, el minero narrador ----------
  let TL = null; // línea de tiempo activa (para leer la envolvente de la voz)
  let POSTER = false; // cuadro para el póster: sin rótulos ni palabras clave
  const FPS = 30;
  // Progreso de escena (0-1) en que la voz dice `word`, estimado por posición en el texto
  function wordP(i, word, fallback) {
    if (!TL) return fallback;
    const s = TL.scenes[i], idx = s.caption.toLowerCase().indexOf(word.toLowerCase());
    if (idx < 0) return fallback;
    const d = s.end - s.start;
    return (s.audioStart - s.start + s.audioDur * idx / s.caption.length) / d;
  }
  function mouthAt(t) {
    if (!TL || !TL.env) return 0;
    const i = Math.floor(t * FPS); return clamp((TL.env[i] || 0) * 7);
  }
  // Dibuja al minero con el origen en la base (centro de los hombros). Unidades locales ~ 420 x 500.
  function drawMiner(ctx, x, y, s, t, alpha = 1) {
    const m = mouthAt(t);
    const blink = (t % 4.3) > 4.15 ? .15 : 1;
    const bob = Math.sin(t * 1.7) * 2 + m * 2;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.scale(s, s);
    // sombra suave detrás
    const sh = ctx.createRadialGradient(0, -220, 40, 0, -220, 300); sh.addColorStop(0, "rgba(0,0,0,.35)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh; ctx.fillRect(-320, -560, 640, 560);
    // torso: chaqueta de alta visibilidad
    ctx.beginPath(); ctx.moveTo(-210, 0); ctx.bezierCurveTo(-205, -110, -170, -150, -70, -168); ctx.lineTo(70, -168); ctx.bezierCurveTo(170, -150, 205, -110, 210, 0); ctx.closePath();
    const jk = ctx.createLinearGradient(-210, -170, 210, 0); jk.addColorStop(0, "#f08a35"); jk.addColorStop(.6, "#d9661f"); jk.addColorStop(1, "#a94a14");
    ctx.fillStyle = jk; ctx.fill();
    // cintas reflectantes
    ctx.fillStyle = "#cfd6dc";
    ctx.fillRect(-200, -78, 400, 16); ctx.fillRect(-196, -40, 392, 16);
    ctx.fillRect(-120, -165, 20, 165); ctx.fillRect(100, -165, 20, 165);
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(-200, -78, 400, 4); ctx.fillRect(-196, -40, 392, 4);
    // cuello de polera y cuello
    ctx.fillStyle = "#2b3138"; ctx.beginPath(); ctx.moveTo(-62, -168); ctx.lineTo(0, -120); ctx.lineTo(62, -168); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#9c6a48"; ctx.beginPath(); ctx.moveTo(-42, -205); ctx.lineTo(42, -205); ctx.lineTo(36, -150); ctx.quadraticCurveTo(0, -128, -36, -150); ctx.closePath(); ctx.fill();
    // insignia
    rr(ctx, 40, -130, 56, 34, 6); ctx.fillStyle = "#1a2129"; ctx.fill();
    ctx.fillStyle = C.copper2; ctx.font = font(700, 13, DISPLAY); ctx.fillText("CAEX", 48, -108);
    ctx.translate(0, bob * .5);
    // orejas
    ctx.fillStyle = "#a8724e"; ctx.beginPath(); ctx.ellipse(-80, -262, 13, 22, 0, 0, 7); ctx.ellipse(80, -262, 13, 22, 0, 0, 7); ctx.fill();
    // cara
    const fg = ctx.createLinearGradient(-80, -330, 80, -180); fg.addColorStop(0, "#c48f68"); fg.addColorStop(1, "#9d6846");
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(0, -258, 78, 96, 0, 0, 7); ctx.fill();
    // barba de días
    const st = ctx.createLinearGradient(0, -225, 0, -165); st.addColorStop(0, "rgba(45,30,22,0)"); st.addColorStop(1, "rgba(45,30,22,.32)");
    ctx.fillStyle = st; ctx.beginPath(); ctx.ellipse(0, -258, 78, 96, 0, 0, 7); ctx.fill();
    // polvo de faena
    ctx.fillStyle = "rgba(120,85,60,.25)"; ctx.beginPath(); ctx.ellipse(-44, -240, 16, 9, .3, 0, 7); ctx.ellipse(50, -300, 12, 6, -.2, 0, 7); ctx.fill();
    // patillas
    ctx.fillStyle = "#2a1d17"; ctx.fillRect(-78, -300, 10, 34); ctx.fillRect(68, -300, 10, 34);
    // cejas
    ctx.strokeStyle = "#2a1d17"; ctx.lineWidth = 8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-50, -296 - m * 3); ctx.quadraticCurveTo(-30, -304 - m * 3, -12, -296); ctx.moveTo(12, -296); ctx.quadraticCurveTo(30, -304 - m * 3, 50, -296 - m * 3); ctx.stroke();
    // ojos
    ctx.fillStyle = "#f2ece4"; ctx.beginPath(); ctx.ellipse(-30, -274, 12, 8 * blink, 0, 0, 7); ctx.ellipse(30, -274, 12, 8 * blink, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#2a1a12"; ctx.beginPath(); ctx.arc(-28, -274, 5.5 * blink, 0, 7); ctx.arc(32, -274, 5.5 * blink, 0, 7); ctx.fill();
    // arrugas de sol
    ctx.strokeStyle = "rgba(90,55,35,.5)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-50, -268); ctx.lineTo(-60, -262); ctx.moveTo(50, -268); ctx.lineTo(60, -262); ctx.stroke();
    // nariz
    ctx.strokeStyle = "rgba(90,55,35,.7)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-4, -268); ctx.quadraticCurveTo(-12, -238, -2, -232); ctx.quadraticCurveTo(8, -230, 12, -236); ctx.stroke();
    // boca (sincronizada con la voz)
    const mh = 3 + 15 * m;
    ctx.fillStyle = "#3a1712"; ctx.beginPath(); ctx.ellipse(0, -204 + mh / 2, 20 + 4 * m, mh / 2 + 2, 0, 0, 7); ctx.fill();
    if (m > .25) { ctx.fillStyle = "#e9e2d8"; ctx.fillRect(-14, -205, 28, 4); }
    // bigote
    ctx.fillStyle = "#2a1d17";
    ctx.beginPath(); ctx.moveTo(-40, -205); ctx.quadraticCurveTo(-30, -228, 0, -222); ctx.quadraticCurveTo(30, -228, 40, -205); ctx.quadraticCurveTo(20, -212, 0, -208); ctx.quadraticCurveTo(-20, -212, -40, -205); ctx.fill();
    // casco
    const hg = ctx.createLinearGradient(-100, -390, 100, -300); hg.addColorStop(0, "#ffffff"); hg.addColorStop(.6, "#dfe3e7"); hg.addColorStop(1, "#aab2ba");
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.moveTo(-96, -312); ctx.bezierCurveTo(-96, -392, 96, -392, 96, -312); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -310, 112, 15, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -386); ctx.lineTo(0, -318); ctx.stroke();
    // lámpara
    rr(ctx, -20, -362, 40, 26, 6); ctx.fillStyle = "#2b3138"; ctx.fill();
    const lg = ctx.createRadialGradient(0, -349, 0, 0, -349, 70); lg.addColorStop(0, "rgba(255,240,205,.95)"); lg.addColorStop(.2, "rgba(255,226,170,.5)"); lg.addColorStop(1, "rgba(255,226,170,0)");
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(0, -349, 70, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff6e0"; ctx.beginPath(); ctx.arc(0, -349, 8, 0, 7); ctx.fill();
    ctx.restore();
  }
  // Recuadro con Rodrigo hablando, para las escenas de producto
  function minerBadge(ctx, t, alpha) {
    if (alpha <= 0) return;
    const cx = 108, cy = 600, r = 66;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, 7); ctx.fillStyle = copperGrad(ctx, cx - r, cy - r, cx + r, cy + r); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = "#1c232b"; ctx.fill(); ctx.clip();
    drawMiner(ctx, cx, cy + 108, .36, t);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = alpha; ctx.textBaseline = "middle";
    ctx.font = font(600, 17, DISPLAY); const w = ctx.measureText("Rodrigo · operador CAEX, Calama").width + 24;
    rr(ctx, cx - 50, cy - r - 44, w, 32, 10); ctx.fillStyle = "rgba(8,10,13,.75)"; ctx.fill();
    ctx.fillStyle = C.ink; ctx.fillText("Rodrigo · operador CAEX, Calama", cx - 38, cy - r - 28);
    ctx.restore();
  }

  // ---------- Fondos ----------
  function darkBg(ctx, t, glowX = .8, glowY = .15) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * glowX, H * glowY, 0, W * glowX, H * glowY, W * .7);
    g.addColorStop(0, "rgba(217,138,61,.25)"); g.addColorStop(1, "rgba(217,138,61,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // curvas de nivel (topografía)
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.045)"; ctx.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 20) {
        const y = 140 + i * 42 + Math.sin(x * .006 + i * .7 + t * .25) * 26 + Math.sin(x * .013 - i + t * .15) * 10;
        x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function vignette(ctx) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .75);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---------- Escena 1: faena al amanecer ----------
  const R1 = rng(7);
  const FAR = Array.from({ length: 34 }, (_, i) => 250 + R1() * 110 + Math.sin(i * .6) * 40);
  const MID = Array.from({ length: 26 }, (_, i) => 330 + R1() * 70 + Math.sin(i * .9 + 1) * 30);
  const DUST = Array.from({ length: 70 }, () => [R1(), R1(), R1()]);
  function ridge(ctx, hs, base, color) {
    ctx.beginPath(); ctx.moveTo(0, H);
    hs.forEach((h, i) => ctx.lineTo(i * W / (hs.length - 1), h + base));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function truck(ctx, x, y, s, dir) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
    ctx.fillStyle = "#e8b13a";
    ctx.beginPath(); ctx.moveTo(-46, -30); ctx.lineTo(18, -34); ctx.lineTo(22, -14); ctx.lineTo(-48, -12); ctx.closePath(); ctx.fill(); // tolva
    ctx.fillStyle = "#c9932a"; ctx.fillRect(14, -26, 22, 14); // cabina
    ctx.fillStyle = "#ffd98a"; ctx.fillRect(28, -24, 7, 6); // ventana
    ctx.fillStyle = "#1a1512"; ctx.fillRect(-44, -13, 80, 6);
    ctx.fillStyle = "#0e0c0b";
    for (const wx of [-30, 24]) { ctx.beginPath(); ctx.arc(wx, -2, 11, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#3a3330"; for (const wx of [-30, 24]) { ctx.beginPath(); ctx.arc(wx, -2, 4, 0, 7); ctx.fill(); }
    // focos
    const hl = ctx.createLinearGradient(36, -18, 150, -10);
    hl.addColorStop(0, "rgba(255,230,180,.55)"); hl.addColorStop(1, "rgba(255,230,180,0)");
    ctx.fillStyle = hl; ctx.beginPath(); ctx.moveTo(36, -20); ctx.lineTo(150, -36); ctx.lineTo(150, 6); ctx.lineTo(36, -14); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function scene1(ctx, p, t) {
    const dawn = ease(p * 1.1);
    ctx.save();
    const z = 1 + .06 * p; ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    const sky = ctx.createLinearGradient(0, 0, 0, 460);
    sky.addColorStop(0, hexMix("#07090c", "#141a26", dawn));
    sky.addColorStop(.6, hexMix("#1a120e", "#5a3220", dawn));
    sky.addColorStop(1, hexMix("#3a1d10", "#f0a35a", dawn));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // estrellas que se apagan
    const RS = rng(3); ctx.fillStyle = `rgba(255,255,255,${.6 * (1 - dawn)})`;
    for (let i = 0; i < 60; i++) { ctx.fillRect(RS() * W, RS() * 260, 1.6, 1.6); }
    // sol
    const sx = W * .64, sy = lerp(470, 330, dawn);
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 260);
    sg.addColorStop(0, "rgba(255,226,176,.95)"); sg.addColorStop(.12, "rgba(246,194,125,.8)"); sg.addColorStop(1, "rgba(243,140,60,0)");
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ridge(ctx, FAR, 0, hexMix("#1b1513", "#6b4130", dawn));
    ridge(ctx, MID, 10, hexMix("#120e0d", "#3d261d", dawn));
    // rajo abierto: bancos elípticos
    const cx = W * .46, cy = 640;
    for (let k = 0; k < 7; k++) {
      const rx = 640 - k * 78, ry = 170 - k * 21;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = hexMix(k % 2 ? "#1a1310" : "#21170f", k % 2 ? "#4a2e1f" : "#5c3a24", dawn * (1 - k * .1));
      ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.strokeStyle = `rgba(246,194,125,${.12 + .35 * dawn * (1 - k * .12)})`; ctx.lineWidth = 2; ctx.stroke();
    }
    // camión recorriendo un banco
    const a = lerp(Math.PI * 1.12, Math.PI * 1.88, easeIO(p));
    const rx = 640 - 78, ry = 170 - 21;
    const tx = cx + Math.cos(a) * rx, ty = cy + Math.sin(a) * ry;
    // polvo
    for (const [r1, r2, r3] of DUST) {
      const age = (r1 + t * .35) % 1;
      const dx = tx - 40 - age * 160 - r2 * 40, dy = ty - 10 - age * 70 * r3 - r2 * 10;
      ctx.fillStyle = `rgba(214,170,120,${.18 * (1 - age) * (.4 + dawn)})`;
      ctx.beginPath(); ctx.arc(dx, dy, 6 + age * 26 * r3, 0, 7); ctx.fill();
    }
    truck(ctx, tx, ty, 1.15, 1);
    ctx.restore();
    // bruma de calor
    const haze = ctx.createLinearGradient(0, 380, 0, 520);
    haze.addColorStop(0, "rgba(243,180,106,0)"); haze.addColorStop(.5, `rgba(243,180,106,${.08 * dawn})`); haze.addColorStop(1, "rgba(243,180,106,0)");
    ctx.fillStyle = haze; ctx.fillRect(0, 380, W, 140);
    vignette(ctx);
    // Rodrigo contando su historia
    const mk = ease(seg(p, 0, .12));
    drawMiner(ctx, 1010, 720 + 40 * (1 - mk), 1.2, t, mk);
    if (POSTER) return;
    // rótulo del narrador y palabras clave sincronizadas con la voz
    const nk = ease(seg(p, .06, .16)) * (1 - ease(seg(p, .9, 1)));
    if (nk > 0) {
      ctx.save(); ctx.globalAlpha = nk; ctx.textBaseline = "middle";
      rr(ctx, 72, 470, 330, 76, 14); ctx.fillStyle = "rgba(8,10,13,.72)"; ctx.fill();
      ctx.fillStyle = copperGrad(ctx, 72, 470, 80, 546); ctx.fillRect(72, 470, 5, 76);
      ctx.fillStyle = C.ink; ctx.font = font(700, 26, DISPLAY); ctx.fillText("Rodrigo", 94, 494);
      ctx.fillStyle = C.muted; ctx.font = font(500, 17, BODY); ctx.fillText("Operador CAEX · 15 años en faena, Calama", 94, 524);
      ctx.restore();
    }
    const kw = ["Calama", "siete", "polvo", "altura", "camiones"].map((w) => wordP(0, w, 0));
    const words = [["CALAMA", kw[0], kw[1]], ["7 × 7", kw[1], kw[2]], ["POLVO", kw[2], kw[3]], ["ALTURA", kw[3], kw[4]], ["CAMIONES", kw[4], .97]];
    for (const [w, a0, a1] of words) {
      const k = seg(p, a0, a1); if (k <= 0 || k >= 1) continue;
      const al = Math.min(ease(k * 5), ease((1 - k) * 5));
      ctx.save(); ctx.globalAlpha = al; ctx.font = font(700, 86, DISPLAY); ctx.textBaseline = "alphabetic";
      ctx.fillStyle = C.ink; ctx.fillText(w, 72, 170 - 14 * (1 - ease(k * 4)));
      ctx.fillStyle = copperGrad(ctx, 72, 0, 300, 0); ctx.fillRect(74, 192, 120 * ease(k * 3), 5);
      ctx.restore();
    }
  }

  // ---------- Escena 2: el problema y la marca ----------
  function scene2(ctx, p, t) {
    darkBg(ctx, t, .5, .45);
    const q = 1 - ease(seg(p, .4, .5));
    if (q > 0) {
      drawMiner(ctx, 270, 720, 1.05, t, q);
      ctx.save(); ctx.globalAlpha = q * ease(seg(p, 0, .1)); ctx.textBaseline = "middle";
      ctx.font = font(600, 44, DISPLAY); ctx.fillStyle = C.muted; ctx.fillText("¿Encontrar una buena pega?", 520, 290 - 10 * p);
      ctx.font = font(700, 54, DISPLAY); ctx.fillStyle = C.ink; ctx.fillText("No debería ser tan difícil.", 520, 364 - 10 * p);
      ctx.restore();
    }
    const lp = seg(p, .48, .9);
    if (lp > 0) {
      const g = ctx.createRadialGradient(W / 2, 300, 0, W / 2, 300, 320);
      g.addColorStop(0, `rgba(243,180,106,${.35 * ease(lp)})`); g.addColorStop(1, "rgba(243,180,106,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const sc = lerp(.85, 1, ease(lp * 1.5));
      drawMark(ctx, W / 2, 290, 170 * sc, lp * 1.3, ease(lp * 3));
      drawWordmark(ctx, W / 2, 445 + 18 * (1 - ease(seg(p, .62, .8))), 58, ease(seg(p, .62, .8)), "center");
    }
  }

  // ---------- Escena 3: cargos ----------
  function icon(ctx, kind, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24);
    ctx.strokeStyle = C.copper2; ctx.fillStyle = C.copper2; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    if (kind === "truck") { ctx.moveTo(2, 15); ctx.lineTo(3, 7); ctx.lineTo(15, 6); ctx.lineTo(15, 15); ctx.closePath(); ctx.moveTo(15, 9); ctx.lineTo(20, 9); ctx.lineTo(22, 15); ctx.lineTo(15, 15); ctx.stroke(); ctx.beginPath(); ctx.arc(7, 18, 2.5, 0, 7); ctx.arc(18, 18, 2.5, 0, 7); ctx.fill(); }
    else if (kind === "wrench") { ctx.moveTo(14, 4); ctx.arc(17, 7, 4.5, Math.PI * 1.1, Math.PI * .6, false); ctx.lineTo(5, 20); ctx.lineTo(4, 19); ctx.lineTo(15, 9); ctx.stroke(); }
    else if (kind === "bolt") { ctx.moveTo(13, 2); ctx.lineTo(5, 14); ctx.lineTo(11, 14); ctx.lineTo(10, 22); ctx.lineTo(19, 9); ctx.lineTo(13, 9); ctx.closePath(); ctx.stroke(); }
    else if (kind === "rock") { ctx.moveTo(4, 17); ctx.lineTo(7, 8); ctx.lineTo(14, 5); ctx.lineTo(20, 10); ctx.lineTo(20, 18); ctx.lineTo(10, 20); ctx.closePath(); ctx.moveTo(7, 8); ctx.lineTo(12, 12); ctx.lineTo(20, 10); ctx.moveTo(12, 12); ctx.lineTo(10, 20); ctx.stroke(); }
    else if (kind === "helmet") { ctx.moveTo(3, 17); ctx.lineTo(21, 17); ctx.moveTo(5, 17); ctx.arc(12, 16, 7, Math.PI, 0); ctx.moveTo(12, 9); ctx.lineTo(12, 5); ctx.stroke(); ctx.beginPath(); ctx.arc(12, 13, 1.8, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  const ROLES = [["truck", "Operadores", "CAEX · pala · jumbo"], ["wrench", "Mantenedores", "Mecánica · planta"], ["bolt", "Eléctricos", "Instrumentación"], ["rock", "Geólogos", "Exploración · mina"], ["helmet", "Prevencionistas", "Seguridad · HSEC"]];
  function scene3(ctx, p, t) {
    darkBg(ctx, t, .15, .1);
    const tp = ease(seg(p, 0, .12));
    ctx.save(); ctx.globalAlpha = tp; ctx.textAlign = "center";
    ctx.font = font(600, 22, BODY); ctx.fillStyle = C.copper2; ctx.fillText("EN UN SOLO LUGAR", W / 2, 120);
    ctx.font = font(700, 54, DISPLAY); ctx.fillStyle = C.ink; ctx.fillText("Todas las ofertas mineras de Chile", W / 2, 186 + 10 * (1 - tp));
    ctx.restore();
    const cw = 330, ch = 150, gap = 26;
    ROLES.forEach(([ic, name, sub], i) => {
      const row = i < 3 ? 0 : 1, col = i < 3 ? i : i - 3;
      const n = row ? 2 : 3;
      const x = W / 2 - (n * cw + (n - 1) * gap) / 2 + col * (cw + gap), y = 250 + row * (ch + gap);
      const at = wordP(2, name.slice(0, 8), .3 + i * .1);
      const k = ease(seg(p, at - .02, at + .08)); if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = k; ctx.translate(0, 24 * (1 - k));
      const g = ctx.createLinearGradient(x, y, x, y + ch); g.addColorStop(0, C.surface2); g.addColorStop(1, C.bg2);
      rr(ctx, x, y, cw, ch, 18); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = `rgba(243,180,106,${.15 + .35 * k})`; ctx.lineWidth = 1.5; ctx.stroke();
      rr(ctx, x + 24, y + 30, 64, 64, 16); ctx.fillStyle = "rgba(217,138,61,.12)"; ctx.fill();
      icon(ctx, ic, x + 36, y + 42, 40);
      ctx.textAlign = "left"; ctx.fillStyle = C.ink; ctx.font = font(600, 28, DISPLAY); ctx.fillText(name, x + 108, y + 66);
      ctx.fillStyle = C.muted; ctx.font = font(400, 19, BODY); ctx.fillText(sub, x + 108, y + 96);
      ctx.restore();
    });
  }

  // ---------- Escena 4: búsqueda por región ----------
  // Chile como eje norte-sur con sus 16 regiones; los pines marcan las regiones mineras que nombra la voz
  const PINS = [["Antofagasta", 2, .38], ["Atacama", 3, .53], ["Coquimbo", 4, .68]];
  function scene4(ctx, p, t) {
    darkBg(ctx, t, .25, .3);
    const mx = 360, my0 = 80, mh = 480;
    const ry = (i) => my0 + i * mh / 15;
    const k0 = ease(seg(p, 0, .2));
    ctx.save(); ctx.globalAlpha = k0;
    const lg = ctx.createLinearGradient(0, my0, 0, my0 + mh); lg.addColorStop(0, C.copper2); lg.addColorStop(.4, "rgba(243,180,106,.5)"); lg.addColorStop(1, "rgba(255,255,255,.12)");
    ctx.strokeStyle = lg; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(mx, my0); ctx.lineTo(mx, my0 + mh * k0); ctx.stroke();
    for (let i = 0; i < 16; i++) { ctx.fillStyle = i < 5 ? "rgba(243,180,106,.7)" : "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.arc(mx, ry(i), 4, 0, 7); ctx.fill(); }
    ctx.font = font(600, 16, BODY); ctx.fillStyle = C.muted; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("Arica", mx - 20, ry(0)); ctx.fillText("Santiago", mx - 20, ry(6)); ctx.fillText("Punta Arenas", mx - 20, ry(15));
    ctx.restore();
    PINS.forEach(([name, idx, fb], i) => {
      const at = wordP(3, name, fb);
      const k = ease(seg(p, at - .02, at + .06)); if (k <= 0) return;
      const px = mx, py = ry(idx);
      const pulse = (t * 1.2 + i * .3) % 1;
      ctx.strokeStyle = `rgba(243,180,106,${.6 * (1 - pulse) * k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 8 + pulse * 26, 0, 7); ctx.stroke();
      ctx.fillStyle = C.copper2; ctx.beginPath(); ctx.arc(px, py, 7 * k, 0, 7); ctx.fill();
      ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = "rgba(243,180,106,.5)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px + 12, py); ctx.lineTo(px + 60, py); ctx.stroke();
      ctx.font = font(600, 22, DISPLAY); ctx.fillStyle = C.ink; ctx.textBaseline = "middle"; ctx.fillText(name, px + 70, py);
      ctx.restore();
    });
    // buscador
    const bx = 600, by = 230, bw = 600;
    const sk = ease(seg(p, 0, .12));
    ctx.save(); ctx.globalAlpha = sk; ctx.translate(0, 20 * (1 - sk));
    ctx.font = font(600, 22, BODY); ctx.fillStyle = C.copper2; ctx.fillText("BUSCA A TU MANERA", bx, by - 70);
    ctx.font = font(700, 48, DISPLAY); ctx.fillStyle = C.ink; ctx.fillText("Por cargo o por región", bx, by - 22);
    rr(ctx, bx, by + 10, bw, 74, 18); ctx.fillStyle = "rgba(20,26,32,.9)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.stroke();
    rr(ctx, bx + 10, by + 20, 340, 54, 12); ctx.fillStyle = C.bg2; ctx.fill(); ctx.strokeStyle = "rgba(217,138,61,.7)"; ctx.stroke();
    const query = "Operador CAEX", typed = query.slice(0, Math.floor(query.length * seg(p, .08, .35)));
    ctx.font = font(500, 22, BODY); ctx.fillStyle = C.ink; ctx.textBaseline = "middle"; ctx.fillText(typed, bx + 28, by + 47);
    if ((t * 2) % 1 < .55) { const cw = ctx.measureText(typed).width; ctx.fillRect(bx + 30 + cw, by + 34, 2, 26); }
    rr(ctx, bx + 360, by + 20, 230, 54, 12); ctx.fillStyle = C.bg2; ctx.fill();
    let reg = "Todo Chile"; PINS.forEach(([n, , fb]) => { if (p >= wordP(3, n, fb)) reg = n; });
    ctx.fillStyle = reg === "Todo Chile" ? C.muted : C.ink; ctx.fillText("📍 " + reg, bx + 376, by + 47);
    // resultados que aparecen
    const rk = ease(seg(p, .4, .55));
    for (let i = 0; i < 3; i++) {
      const y = by + 110 + i * 78, k = ease(seg(p, .4 + i * .08, .5 + i * .08)); if (k <= 0) continue;
      ctx.globalAlpha = sk * k;
      rr(ctx, bx, y, bw, 64, 14); ctx.fillStyle = C.surface; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.stroke();
      rr(ctx, bx + 14, y + 12, 40, 40, 10); ctx.fillStyle = C.surface2; ctx.fill();
      ctx.fillStyle = C.ink; ctx.font = font(600, 19, DISPLAY); ctx.fillText(["Operador CAEX · turno 7x7", "Operador de pala hidráulica", "Operador CAEX · faena norte"][i], bx + 70, y + 24);
      ctx.fillStyle = C.muted; ctx.font = font(400, 16, BODY); ctx.fillText(["Calama · Antofagasta", "Copiapó · Atacama", "Ovalle · Coquimbo"][i], bx + 70, y + 46);
      rr(ctx, bx + bw - 110, y + 16, 92, 32, 9); ctx.fillStyle = copperGrad(ctx, bx + bw - 110, y, bx + bw, y + 40); ctx.fill();
      ctx.fillStyle = "#1a0f05"; ctx.font = font(600, 15, BODY); ctx.fillText("Postular", bx + bw - 96, y + 32);
    }
    ctx.restore();
  }

  // ---------- Escena 5: postular directo ----------
  function check(ctx, x, y, s) {
    ctx.save(); ctx.fillStyle = "rgba(76,196,163,.15)"; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
    ctx.strokeStyle = C.ok; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(x - s * .4, y); ctx.lineTo(x - s * .1, y + s * .32); ctx.lineTo(x + s * .45, y - s * .32); ctx.stroke(); ctx.restore();
  }
  function scene5(ctx, p, t) {
    darkBg(ctx, t, .7, .2);
    const up = ease(seg(p, .36, .48));
    const cw = 680, ch = 210, cx = W / 2 - cw / 2, cy = lerp(250, 120, up);
    const k = ease(seg(p, 0, .1));
    ctx.save(); ctx.globalAlpha = k;
    const g = ctx.createLinearGradient(cx, cy, cx, cy + ch); g.addColorStop(0, "rgba(217,138,61,.14)"); g.addColorStop(1, C.bg2);
    rr(ctx, cx, cy, cw, ch, 22); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = "rgba(243,180,106,.5)"; ctx.lineWidth = 1.5; ctx.stroke();
    rr(ctx, cx + 28, cy + 30, 64, 64, 16); ctx.fillStyle = C.surface2; ctx.fill();
    ctx.fillStyle = C.copper2; ctx.font = font(700, 30, DISPLAY); ctx.textBaseline = "middle"; ctx.fillText("M", cx + 48, cy + 63);
    ctx.fillStyle = C.ink; ctx.font = font(700, 30, DISPLAY); ctx.fillText("Operador CAEX · Turno 7x7", cx + 116, cy + 50);
    ctx.fillStyle = C.muted; ctx.font = font(400, 20, BODY); ctx.fillText("Empresa minera · Calama, Antofagasta", cx + 116, cy + 84);
    const tags = [["Nuevo", C.ok], ["Antofagasta", C.muted], ["Turno 7x7", C.copper2]]; let tx = cx + 116;
    ctx.font = font(500, 16, BODY);
    for (const [tg, col] of tags) { const w = ctx.measureText(tg).width + 24; rr(ctx, tx, cy + 118, w, 30, 15); ctx.strokeStyle = col; ctx.globalAlpha = k * .6; ctx.stroke(); ctx.globalAlpha = k; ctx.fillStyle = col; ctx.fillText(tg, tx + 12, cy + 134); tx += w + 8; }
    const btnX = cx + cw - 170, btnY = cy + ch - 70;
    const press = seg(p, .26, .3), pr = press > 0 && press < 1 ? .96 : 1;
    ctx.save(); ctx.translate(btnX + 70, btnY + 24); ctx.scale(pr, pr); ctx.translate(-btnX - 70, -btnY - 24);
    rr(ctx, btnX, btnY, 140, 48, 12); ctx.fillStyle = copperGrad(ctx, btnX, btnY, btnX + 140, btnY + 48); ctx.fill();
    ctx.fillStyle = "#1a0f05"; ctx.font = font(600, 20, BODY); ctx.textAlign = "center"; ctx.fillText("Postular →", btnX + 70, btnY + 25);
    ctx.restore();
    // cursor
    const mp = easeIO(seg(p, .08, .25));
    const curX = lerp(W * .3, btnX + 90, mp), curY = lerp(H * .85, btnY + 30, mp);
    if (press > 0 && press < 1.5) { ctx.strokeStyle = `rgba(243,180,106,${1 - seg(p, .26, .38)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(btnX + 90, btnY + 30, 10 + 50 * seg(p, .26, .38), 0, 7); ctx.stroke(); }
    if (p < .4) {
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(curX, curY); ctx.lineTo(curX, curY + 26); ctx.lineTo(curX + 7, curY + 20); ctx.lineTo(curX + 12, curY + 30); ctx.lineTo(curX + 16, curY + 28); ctx.lineTo(curX + 11, curY + 18); ctx.lineTo(curX + 20, curY + 18); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    // beneficios
    const items = [["Sin registro", .42], ["Sin costo", .55], ["Actualizado cada 4 horas", .72]];
    items.forEach(([txt, at], i) => {
      const k2 = ease(seg(p, at, at + .08)); if (k2 <= 0) return;
      const y = 400 + i * 80;
      ctx.save(); ctx.globalAlpha = k2; ctx.translate(30 * (1 - k2), 0);
      rr(ctx, W / 2 - 300, y, 600, 64, 16); ctx.fillStyle = C.surface; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.stroke();
      check(ctx, W / 2 - 256, y + 32, 20);
      ctx.fillStyle = C.ink; ctx.font = font(600, 28, DISPLAY); ctx.textBaseline = "middle"; ctx.fillText(txt, W / 2 - 214, y + 33);
      ctx.restore();
    });
  }

  // ---------- Escena 6: sin registro, guardar y compartir ----------
  function scene6(ctx, p, t) {
    darkBg(ctx, t, .5, .5);
    const k = ease(seg(p, 0, .15));
    ctx.save(); ctx.globalAlpha = k; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = font(600, 22, BODY); ctx.fillStyle = C.copper2; ctx.fillText("SIN CUENTAS · SIN REGISTRO", W / 2, 150);
    ctx.font = font(700, 60, DISPLAY); ctx.fillStyle = C.ink; ctx.fillText("Guarda y comparte", W / 2, 222 + 16 * (1 - k));
    ctx.restore();
    // tarjeta de oferta con marcador y botón de WhatsApp
    const ck = ease(seg(p, .15, .3)), cx = W / 2 - 320, cy = 300, cw = 640, ch = 150;
    ctx.save(); ctx.globalAlpha = ck; ctx.translate(0, 20 * (1 - ck));
    rr(ctx, cx, cy, cw, ch, 20); ctx.fillStyle = C.surface; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.lineWidth = 1.5; ctx.stroke();
    rr(ctx, cx + 24, cy + 28, 56, 56, 14); ctx.fillStyle = C.surface2; ctx.fill();
    ctx.fillStyle = C.copper2; ctx.font = font(700, 26, DISPLAY); ctx.textBaseline = "middle"; ctx.fillText("M", cx + 43, cy + 57);
    ctx.fillStyle = C.ink; ctx.font = font(700, 26, DISPLAY); ctx.fillText("Mantenedor mecánico · 7x7", cx + 100, cy + 46);
    ctx.fillStyle = C.muted; ctx.font = font(400, 18, BODY); ctx.fillText("Sierra Gorda, Antofagasta", cx + 100, cy + 78);
    // marcador: se llena cuando dice "guardái"
    const sp = wordP(5, "Guardái", .35), saved = p >= sp, pop = 1 + .25 * Math.max(0, 1 - Math.abs(p - sp - .03) * 20);
    const bx = cx + cw - 136, by = cy + 26;
    rr(ctx, bx, by, 52, 52, 12); ctx.fillStyle = saved ? "rgba(217,138,61,.18)" : C.surface2; ctx.fill();
    ctx.save(); ctx.translate(bx + 26, by + 26); ctx.scale(pop, pop);
    ctx.beginPath(); ctx.moveTo(-9, -13); ctx.lineTo(9, -13); ctx.lineTo(9, 13); ctx.lineTo(0, 7); ctx.lineTo(-9, 13); ctx.closePath();
    ctx.strokeStyle = C.copper2; ctx.lineWidth = 2.5; ctx.stroke(); if (saved) { ctx.fillStyle = C.copper2; ctx.fill(); }
    ctx.restore();
    // botón WhatsApp: pulsa cuando dice "WhatsApp"
    const wp = wordP(5, "WhatsApp", .6), wk = ease(seg(p, wp - .05, wp + .05));
    const wx = cx + cw - 72, wy = cy + 26;
    ctx.globalAlpha = ck * (.4 + .6 * wk);
    if (wk > 0) { ctx.shadowColor = `rgba(37,211,102,${.6 * wk})`; ctx.shadowBlur = 30 * wk * (.6 + .4 * Math.sin(t * 6)); }
    rr(ctx, wx, wy, 52, 52, 12); ctx.fillStyle = "#25d366"; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(wx + 26, wy + 25, 12, Math.PI * .75, Math.PI * 2.55); ctx.lineTo(wx + 14, wy + 39); ctx.closePath(); ctx.stroke();
    ctx.restore();
    // la oferta se reparte a la cuadrilla
    if (p > wp) {
      const fk = seg(p, wp, wp + .3);
      for (let i = 0; i < 5; i++) {
        const tx = W / 2 - 240 + i * 120, ty = 560, sx = cx + cw - 46, sy = cy + 52;
        const q = ease(seg(fk, i * .1, i * .1 + .5));
        ctx.save(); ctx.globalAlpha = q;
        ctx.fillStyle = C.surface2; ctx.beginPath(); ctx.arc(tx, ty, 30, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(37,211,102,.7)"; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#eef0f2"; ctx.beginPath(); ctx.ellipse(tx, ty - 4, 16, 10, 0, Math.PI, 0); ctx.fill(); // casco
        ctx.fillStyle = "#b07a55"; ctx.beginPath(); ctx.arc(tx, ty + 6, 10, 0, 7); ctx.fill();
        const mx = lerp(sx, tx, q), my = lerp(sy, ty - 40, q) - Math.sin(q * Math.PI) * 60;
        if (q < 1) { ctx.fillStyle = "#25d366"; ctx.beginPath(); ctx.arc(mx, my, 6, 0, 7); ctx.fill(); }
        ctx.restore();
      }
    }
  }

  // ---------- Escena 7: cierre ----------
  // ---------- Escena del analizador de CV con IA ----------
  function sceneCV(ctx, p, t) {
    darkBg(ctx, t, .3, .2);
    const k = ease(seg(p, 0, .12));
    ctx.save(); ctx.globalAlpha = k; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = font(600, 22, BODY); ctx.fillStyle = C.copper2; ctx.fillText("ANALIZADOR DE CV CON IA", W / 2, 96);
    ctx.font = font(700, 50, DISPLAY); ctx.fillStyle = C.ink; ctx.fillText("Tu currículum, listo pa' la pega", W / 2, 152 + 14 * (1 - k));
    ctx.restore();

    // Hoja del CV que la IA va revisando
    const px = 340, py = 200, pw = 300, ph = 330, scan = ease(seg(p, .12, .5));
    const pk = ease(seg(p, .05, .18));
    ctx.save(); ctx.globalAlpha = pk; ctx.translate(-30 * (1 - pk), 0);
    ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 30;
    rr(ctx, px, py, pw, ph, 8); ctx.fillStyle = "#f7f5f1"; ctx.fill(); ctx.shadowBlur = 0;
    // nombre: dato personal que no se envía (resaltado para completar a mano)
    rr(ctx, px + 24, py + 26, 150, 22, 4); ctx.fillStyle = "#ffe7c2"; ctx.fill();
    ctx.fillStyle = "#7a3b0c"; ctx.font = font(600, 13, BODY); ctx.textBaseline = "middle"; ctx.fillText("[Nombre completo]", px + 32, py + 37);
    ctx.fillStyle = C.copper; ctx.fillRect(px + 24, py + 58, pw - 48, 2);
    const rows = [[90, .55], [112, .8], [126, .7], [150, .4], [172, .85], [186, .75], [200, .6], [224, .4], [246, .8], [260, .65], [284, .4], [298, .7]];
    rows.forEach(([y, w]) => {
      const done = py + y < py + ph * scan;
      ctx.fillStyle = done ? (w < .45 ? C.copper : "#4a525c") : "#cfd3d8";
      ctx.fillRect(px + 24, py + y, (pw - 48) * w, w < .45 ? 7 : 6);
    });
    // rayo de análisis
    if (scan > 0 && scan < 1) {
      const by = py + ph * scan;
      const g = ctx.createLinearGradient(0, by - 40, 0, by + 4);
      g.addColorStop(0, "rgba(243,180,106,0)"); g.addColorStop(1, "rgba(243,180,106,.45)");
      ctx.fillStyle = g; ctx.fillRect(px, by - 40, pw, 44);
      ctx.fillStyle = C.copper2; ctx.fillRect(px - 6, by, pw + 12, 3);
    }
    ctx.restore();

    // Puntaje que sube cuando dice "listo"
    const lp = wordP(6, "listo", .45), sk = ease(seg(p, .2, .3)), sc = Math.round(lerp(48, 86, ease(seg(p, lp - .15, lp + .1))));
    const cx = 820, cy = 290, r = 66;
    ctx.save(); ctx.globalAlpha = sk;
    ctx.lineWidth = 12; ctx.lineCap = "round";
    ctx.strokeStyle = C.surface2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = copperGrad(ctx, cx - r, cy - r, cx + r, cy + r);
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sc / 100); ctx.stroke();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = C.ink; ctx.font = font(700, 40, DISPLAY); ctx.fillText(String(sc), cx, cy - 4);
    ctx.fillStyle = C.muted; ctx.font = font(500, 15, BODY); ctx.fillText("de 100", cx, cy + 26);
    ctx.textAlign = "left"; ctx.font = font(600, 24, DISPLAY); ctx.fillStyle = C.ink; ctx.fillText("Puntaje de tu CV", cx + 96, cy - 14);
    ctx.font = font(400, 17, BODY); ctx.fillStyle = C.muted; ctx.fillText("para el cargo que buscas", cx + 96, cy + 14);
    ctx.restore();

    // Mejoras que entrega
    const items = ["Logros con verbos de acción", "Palabras clave del cargo", "Descarga en Word"];
    items.forEach((txt, i) => {
      const ik = ease(seg(p, lp + i * .07, lp + i * .07 + .08)); if (ik <= 0) return;
      const y = 392 + i * 52;
      ctx.save(); ctx.globalAlpha = ik; ctx.translate(24 * (1 - ik), 0);
      rr(ctx, 750, y, 420, 42, 12); ctx.fillStyle = C.surface; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.stroke();
      check(ctx, 774, y + 21, 13);
      ctx.fillStyle = C.ink; ctx.font = font(600, 19, BODY); ctx.textBaseline = "middle"; ctx.fillText(txt, 800, y + 22);
      ctx.restore();
    });

    // Privacidad: aparece cuando dice "datos personales"
    const dp = wordP(6, "datos personales", .8), dk = ease(seg(p, dp - .02, dp + .06));
    if (dk > 0) {
      ctx.save(); ctx.globalAlpha = dk;
      rr(ctx, 750, 552, 420, 40, 20); ctx.fillStyle = "rgba(76,196,163,.14)"; ctx.fill();
      ctx.strokeStyle = "rgba(76,196,163,.6)"; ctx.lineWidth = 1.5; ctx.stroke();
      // candado
      const lx = 776, ly = 572;
      ctx.strokeStyle = C.ok; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(lx, ly - 5, 5, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = C.ok; rr(ctx, lx - 7, ly - 5, 14, 11, 2); ctx.fill();
      ctx.fillStyle = C.ink; ctx.font = font(600, 15, BODY); ctx.textBaseline = "middle"; ctx.fillText("Tus datos personales no se envían", lx + 16, ly);
      ctx.restore();
    }
  }

  function scene7(ctx, p, t) {
    darkBg(ctx, t, .5, .38);
    const g = ctx.createRadialGradient(W / 2, 250, 0, W / 2, 250, 420);
    g.addColorStop(0, `rgba(243,180,106,${.3 * ease(p * 3)})`); g.addColorStop(1, "rgba(243,180,106,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawMark(ctx, W / 2, 230, 150, p * 2.4, ease(p * 4));
    drawWordmark(ctx, W / 2, 370, 60, ease(seg(p, .1, .3)), "center");
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.globalAlpha = ease(seg(p, .3, .5)); ctx.font = font(600, 36, DISPLAY); ctx.fillStyle = C.ink;
    ctx.fillText("Tu próxima faena empieza aquí.", W / 2, 448);
    ctx.globalAlpha = ease(seg(p, .45, .65));
    ctx.font = font(500, 22, BODY); const w = ctx.measureText("trabajaenmineria.cl").width + 48;
    rr(ctx, W / 2 - w / 2, 500, w, 46, 23); ctx.strokeStyle = "rgba(243,180,106,.6)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = C.copper2; ctx.fillText("trabajaenmineria.cl", W / 2, 524);
    ctx.restore();
  }

  // scene7 es el cierre con la marca; sceneCV va justo antes
  const SCENES = [scene1, scene2, scene3, scene4, scene5, scene6, sceneCV, scene7];

  // ---------- Subtítulos ----------
  function chunks(text) {
    const words = text.split(" "), out = []; let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > 52 || (/[.:?]$/.test(cur) && cur.length > 22)) { out.push(cur.trim()); cur = ""; }
      cur += " " + w;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function buildCues(timeline) {
    const cues = [];
    timeline.scenes.forEach((s) => {
      const parts = chunks(s.caption), total = parts.reduce((a, c) => a + c.length, 0);
      let t = s.audioStart;
      for (const c of parts) { const d = s.audioDur * c.length / total; cues.push({ start: t, end: t + d, text: c }); t += d; }
    });
    return cues;
  }
  function drawSubtitle(ctx, t, cues) {
    const c = cues.find((q) => t >= q.start && t < q.end + .15); if (!c) return;
    ctx.save(); ctx.font = font(600, 30, BODY); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = ctx.measureText(c.text).width + 44;
    rr(ctx, W / 2 - w / 2, H - 92, w, 54, 14); ctx.fillStyle = "rgba(8,10,13,.72)"; ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(c.text, W / 2, H - 64);
    ctx.restore();
  }

  // ---------- Cuadro completo ----------
  const XFADE = .4;
  function drawScene(ctx, i, t, tl) {
    const s = tl.scenes[i];
    SCENES[i](ctx, clamp((t - s.start) / (s.end - s.start)), t);
  }
  function drawFrame(ctx, t, tl, opts = {}) {
    TL = tl; POSTER = !!opts.poster;
    if (POSTER) { drawScene(ctx, 0, t, tl); POSTER = false; return; }
    let i = tl.scenes.findIndex((s) => t < s.end); if (i < 0) i = tl.scenes.length - 1;
    const s = tl.scenes[i];
    if (i > 0 && t - s.start < XFADE) {
      drawScene(ctx, i - 1, t, tl);
      ctx.save(); ctx.globalAlpha = easeIO((t - s.start) / XFADE); drawScene(ctx, i, t, tl); ctx.restore();
    } else drawScene(ctx, i, t, tl);
    // Rodrigo sigue narrando en un recuadro durante las escenas de producto
    const s3 = tl.scenes[2], s7 = tl.scenes[tl.scenes.length - 1];
    if (t >= s3.start) minerBadge(ctx, t, ease((t - s3.start) / .6) * (1 - ease((t - (s7.end - 1.2)) / .6)));
    if (!opts.noSubs) drawSubtitle(ctx, t, tl.cues);
    // fundido de entrada y salida
    const fade = Math.max(1 - t / .6, (t - (tl.duration - .8)) / .8);
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(fade)})`; ctx.fillRect(0, 0, W, H); }
  }

  // Calcula la línea de tiempo a partir de las duraciones de audio
  function buildTimeline(captions, durations, { lead = .6, gap = .55, tail = 2 } = {}) {
    const scenes = []; let t = 0;
    durations.forEach((d, i) => {
      const start = t, audioStart = (i === 0 ? lead : start + gap * .5);
      const end = audioStart + d + (i === durations.length - 1 ? tail : gap * .5);
      scenes.push({ start, end, audioStart, audioDur: d, caption: captions[i] });
      t = end;
    });
    const tl = { scenes, duration: t };
    tl.cues = buildCues(tl);
    return tl;
  }

  global.Explainer = { W, H, FPS, drawFrame, buildTimeline, drawMark, drawWordmark, drawMiner };
})(window);
