// Guías largas (una página por tema) para /guias/<slug>.
// Texto propio de trabajaenmineria.cl. Las cifras "hoy" se calculan con las ofertas del día (objeto S).
// Las reglas legales se describen en términos generales y se remite a la fuente oficial para el detalle.

const n = (x) => Number(x || 0).toLocaleString("es-CL");

export function guiasLargas(S) {
  const t = S.turnos;
  return [
    {
      slug: "turnos-mineros",
      tag: "Turnos y jornada",
      title: "Turnos en minería: 7x7, 14x14, 4x3 y 5x2 explicados",
      description: "Qué significa cada turno minero (7x7, 14x14, 4x3, 5x2), cómo se vive la jornada en faena, ventajas, costos y cuántas ofertas hay hoy con cada sistema.",
      lead: "El turno define tu vida más que el cargo. Antes de postular, entiende qué significa cada sistema y cuál te acomoda.",
      faq: [
        ["¿Qué significa turno 7x7?", "Siete días seguidos de trabajo en faena, normalmente con jornadas de 12 horas, seguidos de siete días de descanso en tu casa."],
        ["¿El turno 14x14 es legal en Chile?", "Los sistemas que se apartan de la jornada ordinaria necesitan una autorización de la Dirección del Trabajo (sistema excepcional de distribución de jornada). Las empresas mineras la tramitan para cada faena."],
        ["¿Qué turno conviene para empezar?", "Depende de tu familia y de dónde vives. El 4x3 o el 5x2 te deja más cerca de casa; el 7x7 concentra el descanso y es el más común en la gran minería del norte."],
      ],
      body: `
        <p>En la minería chilena casi nadie trabaja "de lunes a viernes". Las faenas operan las 24 horas, los 365 días, muchas veces a cientos de kilómetros de la ciudad más cercana. Por eso el trabajo se organiza en <b>turnos</b>: un bloque de días seguidos en faena y otro bloque de descanso. El nombre del turno es simplemente esa proporción.</p>

        <h2>Los turnos más comunes</h2>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Turno</th><th>Qué significa</th><th>Dónde se ve más</th><th>Ofertas hoy*</th></tr></thead>
          <tbody>
            <tr><td><b>7x7</b></td><td>7 días de trabajo y 7 de descanso, con jornadas de 12 horas (día o noche).</td><td>Operación de mina y planta en la gran minería del norte.</td><td>${n(t["7x7"])}</td></tr>
            <tr><td><b>14x14</b></td><td>14 días en faena y 14 en casa. Bloques largos, típicos de proyectos y faenas muy alejadas.</td><td>Construcción, montaje, contratistas, proyectos.</td><td>${n(t["14x14"])}</td></tr>
            <tr><td><b>4x3 / 4x4</b></td><td>4 días de trabajo y 3 o 4 de descanso.</td><td>Faenas cercanas a ciudades, mantención, áreas de apoyo.</td><td>${n(t["4x3"] + t["4x4"])}</td></tr>
            <tr><td><b>5x2</b></td><td>5 días de trabajo y 2 de descanso, similar a una jornada de oficina.</td><td>Oficinas centrales, talleres en ciudad, administración.</td><td>${n(t["5x2"])}</td></tr>
            <tr><td><b>10x10, 8x6 y otros</b></td><td>Variantes autorizadas para faenas específicas.</td><td>Según cada empresa.</td><td>${n(t.otros)}</td></tr>
          </tbody>
        </table></div>
        <p class="note">*Ofertas publicadas hoy en trabajaenmineria.cl que mencionan ese turno en el título o la descripción. Muchas ofertas no indican el turno, así que la cifra real es mayor.</p>

        <h2>Cómo es un día en un turno 7x7</h2>
        <p>Un día típico parte antes de las seis de la mañana. Desayunas en el campamento, tomas el bus a la mina y participas en la charla de seguridad de inicio de turno, donde se revisan los riesgos del día. Luego vienen 12 horas de trabajo, con colación y pausas programadas. Al terminar vuelves al campamento, cenas y duermes. Al día siguiente, lo mismo.</p>
        <p>En muchos 7x7 la semana se reparte entre turnos de día y de noche. Ese cambio es lo que más cuesta al principio: el cuerpo tarda en adaptarse y el sueño se vuelve un tema de salud y de seguridad.</p>

        <h2>Lo bueno y lo difícil</h2>
        <ul class="pro-con">
          <li><b>A favor:</b> días de descanso completos en tu casa, sueldos y bonos de turno que pocas industrias pagan, alojamiento y alimentación cubiertos en faena, traslados pagados en muchos contratos.</li>
          <li><b>En contra:</b> tiempo lejos de la familia, cumpleaños y fechas importantes que te tocarán en faena, jornadas largas, cambio de horario de día a noche y, en altura, el esfuerzo extra del cuerpo.</li>
        </ul>

        <h2>Qué es la jornada excepcional</h2>
        <p>El Código del Trabajo fija una jornada ordinaria semanal. Cuando una faena necesita turnos distintos, como 7x7 o 14x14, la empresa debe pedir a la Dirección del Trabajo la autorización de un <b>sistema excepcional de distribución de jornada de trabajo y descansos</b>. Si tienes dudas sobre tu contrato, la <a href="https://www.dt.gob.cl" rel="noopener" target="_blank">Dirección del Trabajo</a> es la fuente oficial.</p>

        <h2>Antes de aceptar un turno, pregúntate</h2>
        <ol>
          <li>¿Desde dónde se sube a faena y quién paga el traslado (avión, bus)?</li>
          <li>¿El turno es solo de día, solo de noche o rotativo?</li>
          <li>¿La faena está en altura geográfica? Eso cambia los exámenes y el descanso.</li>
          <li>¿Cómo se organiza tu familia los días que no estás?</li>
          <li>¿El sueldo informado es base o incluye bonos de turno y de faena?</li>
        </ol>`,
    },
    {
      slug: "entrar-a-la-mineria-sin-experiencia",
      tag: "Primer empleo",
      title: "Cómo entrar a la minería sin experiencia: guía paso a paso",
      description: "Las puertas de entrada reales a la minería en Chile para quien no tiene experiencia: cargos de inicio, licencias, cursos, exámenes y cómo postular para que te llamen.",
      lead: "Nadie nace con experiencia en minería. Estas son las puertas de entrada que de verdad funcionan y el orden en que conviene abrirlas.",
      faq: [
        ["¿Se puede trabajar en minería sin experiencia?", "Sí. Hay cargos de inicio como ayudante, aseo industrial, bodega, alimentación, guardia o conductor de buses de personal, sobre todo en empresas contratistas."],
        ["¿Qué curso conviene hacer primero?", "Una licencia profesional (clase D o A4/A5 según tu interés) y cursos básicos de seguridad como trabajo en altura y primeros auxilios. Verifica que el OTEC esté registrado en SENCE."],
        ["¿Cuánto me demoro en conseguir el primer trabajo?", "Depende de tu región y perfil, pero quienes postulan con constancia (varias ofertas por semana, con un CV claro) suelen tener respuestas antes."],
      ],
      body: `
        <p>Hoy hay <b>${n(S.total)} ofertas</b> de minería publicadas en el sitio, y <b>${n(S.sinExp)}</b> de ellas están marcadas como cargos sin experiencia o de inicio. La mayoría de quienes trabajan hoy en la minería entró por una puerta pequeña: una contratista, un cargo de apoyo, un reemplazo. Lo importante es entrar y empezar a sumar faena en tu CV.</p>

        <h2>1. Elige tu puerta de entrada</h2>
        <ul>
          <li><b>Ayudante</b> (mecánico, eléctrico, de soldador): aprendes en terreno al lado de un maestro. Es la ruta clásica a mantenedor.</li>
          <li><b>Aseo industrial y servicios</b>: limpieza de plantas y campamentos, alimentación, lavandería. Te da acceso a faena y a sus contratistas.</li>
          <li><b>Bodega y logística</b>: control de materiales, despacho, grúa horquilla (con licencia D).</li>
          <li><b>Conductor</b>: buses de personal o camiones de apoyo, con la licencia profesional que corresponda.</li>
          <li><b>Guardia o rondín</b>: con curso OS-10 vigente.</li>
          <li><b>Programas de formación</b>: algunas mineras y contratistas abren cada año programas para operadores y mantenedores sin experiencia. Se publican en sus portales de empleo y suelen tener muchos postulantes, así que postula apenas aparezcan.</li>
        </ul>

        <h2>2. Prepara lo que te van a pedir</h2>
        <ul>
          <li><b>Licencia de conducir</b>: muchas ofertas piden al menos clase B; para operar equipos, clase D; para camiones, A4 o A5. Lee nuestra <a href="/guias/licencias-y-cursos-para-mineria">guía de licencias y cursos</a>.</li>
          <li><b>Cursos básicos de seguridad</b>: trabajo en altura, extintores, primeros auxilios, manejo defensivo. Son cortos y suman en el filtro.</li>
          <li><b>Enseñanza media completa</b> y, si puedes, un título técnico (mecánica, electricidad, minería, prevención).</li>
          <li><b>Salud al día</b>: vas a rendir exámenes preocupacionales. Revisa la <a href="/guias/examenes-preocupacionales">guía de exámenes</a>.</li>
        </ul>
        <p>Para financiar cursos, revisa los programas de capacitación de <a href="https://sence.gob.cl" rel="noopener" target="_blank">SENCE</a> y verifica siempre que el OTEC esté registrado antes de pagar.</p>

        <h2>3. Arma un CV que pase el primer filtro</h2>
        <p>Si no tienes experiencia minera, muestra lo que sí tienes: trabajos en construcción, agricultura, transporte o industria cuentan, porque demuestran turnos, disciplina y seguridad. Pon arriba tus licencias y cursos con su fecha. Puedes <a href="/cv.html">armar tu CV para minería gratis</a> y descargarlo en Word o PDF.</p>

        <h2>4. Postula con método</h2>
        <ol>
          <li>Filtra por tu región y por "Sin experiencia" en el buscador.</li>
          <li>Postula a <b>al menos diez ofertas por semana</b>. Es un juego de constancia.</li>
          <li>Guarda las ofertas y anota a cuáles postulaste y cuándo.</li>
          <li>Si te llaman, ten tu carnet, certificados y licencias escaneados y listos.</li>
        </ol>

        <h2>5. Cuídate de las ofertas falsas</h2>
        <p>Quien busca su primer trabajo es el blanco favorito de las estafas: "inicio inmediato", "sueldo alto sin experiencia", "paga el curso y quedas contratado". Ninguna empresa seria te cobra por postular. Antes de entregar datos o dinero, <a href="/guias/ofertas-de-trabajo-falsas-en-mineria">revisa cómo detectar una oferta falsa</a> y verifica la empresa por su RUT.</p>`,
    },
    {
      slug: "licencias-y-cursos-para-mineria",
      tag: "Licencias y cursos",
      title: "Licencias de conducir y cursos que piden en minería (clase D, A4, A5 y más)",
      description: "Qué licencias profesionales y cursos piden las ofertas de minería en Chile: clase D para maquinaria, A4 y A5 para camiones, licencia interna de faena y certificaciones de seguridad.",
      lead: "En minería, una licencia o un curso certificado puede ser la diferencia entre quedar en la lista o ni siquiera llegar a la entrevista.",
      faq: [
        ["¿Qué licencia necesito para operar maquinaria en minería?", "Para conducir maquinaria automotriz como cargadores, retroexcavadoras o grúas horquilla por vías públicas se usa la licencia clase D. Además, cada faena entrega su propia licencia interna tras capacitar y evaluar al operador."],
        ["¿Qué diferencia hay entre A4 y A5?", "Ambas son licencias profesionales para vehículos de carga. La A5 habilita para vehículos de carga de mayor tamaño, como los articulados, y suele pedirse para camiones de alto tonelaje fuera de la mina."],
        ["¿Qué es la licencia interna de faena?", "Una autorización que entrega cada empresa minera para operar equipos o conducir dentro de su faena, después de un curso y una evaluación propios."],
      ],
      body: `
        <p>Hoy <b>${n(S.licencia)}</b> de las ofertas publicadas mencionan una licencia de conducir en sus requisitos. Este es un resumen práctico; los requisitos exactos para obtener cada licencia los define la normativa de tránsito y los informa <a href="https://www.conaset.cl" rel="noopener" target="_blank">CONASET</a> y tu municipalidad.</p>

        <h2>Licencias que más se piden</h2>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Licencia</th><th>Para qué sirve en minería</th><th>Cargos típicos</th></tr></thead>
          <tbody>
            <tr><td><b>Clase B</b></td><td>Camionetas y vehículos livianos. Es la base de casi todo.</td><td>Supervisores, prevencionistas, técnicos, inspectores.</td></tr>
            <tr><td><b>Clase D</b></td><td>Maquinaria automotriz: cargadores, retroexcavadoras, motoniveladoras, grúas horquilla.</td><td>Operador de equipos, bodeguero con grúa horquilla.</td></tr>
            <tr><td><b>A2 / A3</b></td><td>Transporte de personas (furgones y buses).</td><td>Conductor de bus de personal.</td></tr>
            <tr><td><b>A4</b></td><td>Vehículos de carga simple.</td><td>Conductor de camión aljibe, de combustible o de apoyo.</td></tr>
            <tr><td><b>A5</b></td><td>Vehículos de carga de mayor tamaño, incluidos los articulados.</td><td>Conductor de camión de alto tonelaje y tracto camión.</td></tr>
          </tbody>
        </table></div>
        <p>Las licencias profesionales (clase A) se obtienen después de un curso en una escuela de conductores profesionales y exigen experiencia previa con licencia clase B. Revisa los años de experiencia y la edad mínima vigentes antes de inscribirte.</p>

        <h2>La licencia interna de faena</h2>
        <p>Tener la licencia municipal no basta para operar un camión de extracción o una pala. Cada faena capacita y evalúa a sus operadores y les entrega una <b>licencia interna</b> para cada equipo. Por eso es común que las ofertas pidan "licencia D o experiencia en equipos" y luego la empresa forme al trabajador en sus propios equipos.</p>

        <h2>Cursos y certificaciones que suman</h2>
        <ul>
          <li><b>Trabajo en altura física</b> y uso de arnés.</li>
          <li><b>Aislamiento y bloqueo de energías</b> (muy pedido en mantención).</li>
          <li><b>Espacios confinados</b>.</li>
          <li><b>Rigger y operador de grúa</b> (izaje de cargas).</li>
          <li><b>Primeros auxilios</b> y uso de extintores.</li>
          <li><b>Manejo defensivo y 4x4</b> para conductores.</li>
          <li><b>Soldadura certificada</b> según norma para soldadores.</li>
        </ul>
        <p>Antes de pagar un curso, comprueba que el organismo capacitador (OTEC) esté registrado en <a href="https://sence.gob.cl" rel="noopener" target="_blank">SENCE</a> y pregunta si el certificado es reconocido por las empresas. Desconfía de quien te ofrezca "curso más contrato asegurado".</p>

        <h2>Cómo mostrarlo en tu CV</h2>
        <p>Pon tus licencias en la parte de arriba, con la clase y la fecha de vencimiento. Luego los cursos, con el organismo y el año. Es lo primero que busca un reclutador minero. Con el <a href="/cv.html">creador de CV</a> puedes ordenarlo en minutos.</p>
        <p>Revisa también qué pide cada cargo en el <a href="/recursos/">Centro de recursos</a>.</p>`,
    },
    {
      slug: "examenes-preocupacionales",
      tag: "Selección",
      title: "Exámenes preocupacionales en minería: qué evalúan y cómo prepararte",
      description: "Qué incluyen los exámenes preocupacionales para trabajar en minería en Chile, la evaluación para altura geográfica, el test de drogas y consejos para no quedar fuera.",
      lead: "Muchos postulantes pasan la entrevista y quedan fuera en los exámenes. La mayoría de las veces se podía evitar.",
      faq: [
        ["¿Qué son los exámenes preocupacionales?", "Una evaluación de salud que se hace antes de contratar, para verificar que puedes trabajar de forma segura en el cargo y en las condiciones de la faena."],
        ["¿Quién paga los exámenes preocupacionales?", "Normalmente los coordina y paga la empresa. Si alguien te pide dinero para 'reservar tu cupo' o pagar exámenes antes de una oferta formal, desconfía."],
        ["¿Qué pasa si trabajo en altura geográfica?", "Las faenas sobre los 3.000 metros exigen una evaluación especial por la exposición a la altura (hipobaria intermitente crónica), con exámenes adicionales."],
      ],
      body: `
        <p>Cuando una empresa te selecciona, antes de firmar te envía a un centro médico para la <b>batería de exámenes preocupacionales</b>. El objetivo no es descartarte, sino comprobar que puedes hacer el trabajo sin poner en riesgo tu salud ni la de tu equipo.</p>

        <h2>Qué suelen incluir</h2>
        <ul>
          <li>Examen físico general, presión arterial, peso y talla.</li>
          <li>Exámenes de sangre y orina (glicemia, colesterol, función renal, entre otros).</li>
          <li>Electrocardiograma y, según el cargo, evaluación cardiovascular más completa.</li>
          <li>Audiometría y evaluación de la vista.</li>
          <li><b>Test de drogas y alcohol</b>: hoy es un filtro habitual en la selección minera.</li>
          <li><b>Examen psicosensotécnico</b> para conductores y operadores de equipos.</li>
          <li>Evaluación psicológica en algunos cargos.</li>
        </ul>

        <h2>La evaluación para altura geográfica</h2>
        <p>Muchas faenas del norte están sobre los 3.000 metros. Allí el cuerpo recibe menos oxígeno y la normativa chilena exige evaluar a quienes trabajarán expuestos a gran altitud (hipobaria intermitente crónica). Se revisan con más cuidado el corazón, los pulmones, la presión y la calidad del sueño. Si tienes presión alta, apnea del sueño o alguna enfermedad crónica, contrólala con tu médico antes de postular.</p>

        <h2>Cómo prepararte</h2>
        <ol>
          <li><b>Duerme bien</b> la semana anterior.</li>
          <li><b>Nada de alcohol</b> en los días previos.</li>
          <li><b>Llega en ayunas</b> si te lo indican (normalmente de 8 a 12 horas).</li>
          <li><b>Lleva tus recetas</b> si tomas medicamentos: algunos pueden dar positivo en el test de drogas y es mejor informarlo.</li>
          <li><b>Lleva tus lentes</b> si los usas.</li>
          <li><b>No fumes</b> ni hagas ejercicio intenso justo antes.</li>
        </ol>

        <h2>Ojo con los cobros</h2>
        <p>Los exámenes preocupacionales los coordina la empresa que te va a contratar, con su centro médico o su mutualidad. Si una "empresa" te pide transferir dinero para exámenes, cursos o para asegurar tu cupo antes de una oferta formal, es una señal clásica de estafa. <a href="/guias/ofertas-de-trabajo-falsas-en-mineria">Aprende a reconocerlas</a>.</p>`,
    },
    {
      slug: "ofertas-de-trabajo-falsas-en-mineria",
      tag: "Seguridad",
      title: "Ofertas de trabajo falsas en minería: cómo detectarlas y verificar la empresa",
      description: "Las señales de una oferta de empleo minero falsa, las estafas más comunes en Chile y cómo verificar una empresa por su RUT antes de entregar tus datos o tu dinero.",
      lead: "Las estafas laborales usan el nombre de mineras reales y prometen justo lo que quieres oír. Esta es la lista para revisar antes de dar un paso.",
      faq: [
        ["¿Una empresa minera puede cobrarme por postular?", "No. Las empresas serias no cobran por postular, por reservar un cupo ni por darte un contrato. Si te piden dinero, desconfía."],
        ["¿Cómo verifico si una empresa existe?", "Búscala por su RUT, revisa que tenga un sitio y un portal de empleo oficiales, y compara los datos de contacto. En mirrow.cl puedes revisar empresas por RUT."],
        ["¿Dónde denuncio una oferta falsa?", "Puedes denunciar a la Policía de Investigaciones (PDI) o a Carabineros, y avisar al portal donde la viste."],
      ],
      body: `
        <p>Cada semana aparecen avisos que usan el nombre de grandes mineras o contratistas para pedir dinero o datos personales. Funcionan porque prometen lo que todos queremos: un buen sueldo, un turno 7x7 y empezar de inmediato.</p>

        <h2>Señales de alerta</h2>
        <ul class="flags">
          <li>🚩 <b>Te piden dinero</b> para un curso "obligatorio", exámenes, uniforme, pasajes o para "reservar tu cupo".</li>
          <li>🚩 <b>Sueldo muy alto sin experiencia</b> y sin requisitos claros.</li>
          <li>🚩 <b>"Inicio inmediato"</b> sin entrevista ni exámenes.</li>
          <li>🚩 Te contactan <b>solo por WhatsApp</b> y piden foto de tu carnet por ambos lados.</li>
          <li>🚩 El correo es de un servicio gratuito (Gmail, Hotmail) y no del dominio de la empresa.</li>
          <li>🚩 Presión para decidir rápido: "quedan pocos cupos".</li>
          <li>🚩 Faltas de ortografía y logos de mala calidad.</li>
        </ul>

        <h2>Cómo verificar en cinco minutos</h2>
        <ol>
          <li><b>Busca la oferta en el portal oficial</b> de la empresa. Si no está ahí, sospecha.</li>
          <li><b>Revisa la empresa por su RUT</b>. En <a href="https://www.mirrow.cl?utm_source=trabajaenmineria&amp;utm_medium=referral&amp;utm_campaign=guia-estafas" data-mirrow="guia-estafas" target="_blank" rel="noopener">Mirrow</a> puedes buscar empresas por RUT y ver quién está realmente detrás de la oferta.</li>
          <li><b>Compara los datos de contacto</b> con los del sitio oficial.</li>
          <li><b>Nunca pagues</b> para postular ni para asegurar un cupo.</li>
          <li><b>No envíes documentos</b> (carnet, cuenta bancaria) hasta tener una oferta formal de una empresa verificada.</li>
        </ol>

        <h2>Si ya caíste</h2>
        <p>Guarda todas las conversaciones y comprobantes, avisa a tu banco si transferiste dinero y denuncia en la <a href="https://www.pdichile.cl" rel="noopener" target="_blank">PDI</a> o en Carabineros. Avisa también al portal donde viste el aviso para que lo den de baja.</p>

        <h2>Cómo te protege trabajaenmineria.cl</h2>
        <p>Aquí no te pedimos registrarte ni te cobramos nada: al postular vas directo a la publicación original. Aun así, revisa siempre a la empresa antes de entregar tus datos. Si ves una oferta sospechosa en el sitio, avísanos por Instagram en <a href="https://www.instagram.com/trabajaenmineriacl/" target="_blank" rel="noopener">@trabajaenmineriacl</a>.</p>`,
    },
    {
      slug: "cv-para-mineria",
      tag: "Currículum",
      title: "CV para minería: cómo armar un currículum que pase el primer filtro",
      description: "Cómo hacer un currículum para trabajar en minería en Chile: estructura, licencias, equipos, faenas, cursos y palabras clave que buscan los reclutadores. Con plantilla gratis.",
      lead: "Un reclutador minero revisa cientos de CV por oferta. El tuyo tiene unos segundos para mostrar lo que buscan.",
      faq: [
        ["¿Qué debe tener un CV para minería?", "Datos de contacto, cargo al que postulas, licencias con vencimiento, cursos y certificaciones, experiencia con faenas, equipos y turnos, y formación."],
        ["¿Debo poner foto en el CV?", "No es obligatorio. Si la pones, que sea reciente, con fondo neutro y ropa de trabajo o formal."],
        ["¿Qué largo debe tener?", "Una o dos páginas. Lo más importante debe quedar en la primera mitad de la primera página."],
      ],
      body: `
        <p>En la minería, un CV no se lee: se escanea. El reclutador busca en segundos tres cosas: <b>si tienes las licencias y cursos que pide el cargo</b>, <b>si conoces los equipos o procesos</b> y <b>si has trabajado en turnos y faenas</b>. Si eso no está a la vista, pasa al siguiente.</p>

        <h2>Estructura recomendada</h2>
        <ol>
          <li><b>Encabezado</b>: nombre, ciudad, teléfono y correo. No hace falta dirección completa ni RUT.</li>
          <li><b>Cargo al que postulas</b> y un resumen de 2 o 3 líneas.</li>
          <li><b>Licencias y certificaciones</b>, con clase y vencimiento.</li>
          <li><b>Experiencia</b>: empresa, faena, cargo, fechas, turno y logros.</li>
          <li><b>Equipos y herramientas</b> que manejas (marca y modelo si los conoces).</li>
          <li><b>Formación</b>: título técnico o profesional y cursos.</li>
        </ol>

        <h2>Escribe la experiencia con datos</h2>
        <p>Compara estas dos líneas:</p>
        <ul>
          <li>❌ "Operador de camión en minera."</li>
          <li>✅ "Operador de camión de extracción en faena de cobre, turno 7x7, 3 años sin incidentes con tiempo perdido."</li>
        </ul>
        <p>La segunda dice equipo, faena, turno, tiempo y seguridad en una sola frase. Eso es lo que busca el reclutador.</p>

        <h2>Palabras clave por cargo</h2>
        <p>Muchas empresas usan sistemas que filtran por palabras. Usa los mismos términos que aparecen en la oferta: si dice "mantención preventiva", "check list", "aislamiento y bloqueo" o "licencia A5", que esas palabras estén en tu CV si es verdad que las tienes. En cada <a href="/recursos/">perfil de cargo</a> encontrarás las competencias más pedidas.</p>

        <h2>Errores que te dejan fuera</h2>
        <ul>
          <li>Licencias vencidas o sin fecha.</li>
          <li>Correos poco serios o teléfonos que no contestas.</li>
          <li>Más de dos páginas, con texto apretado y sin orden.</li>
          <li>El mismo CV para todos los cargos. Ajusta el resumen a cada postulación.</li>
        </ul>

        <h2>Hazlo gratis aquí</h2>
        <p>El <a href="/cv.html">creador de CV de trabajaenmineria.cl</a> te guía paso a paso, sugiere palabras clave según el cargo y lo descargas en Word o PDF. No necesitas registrarte y tus datos no se guardan.</p>`,
    },
  ];
}
