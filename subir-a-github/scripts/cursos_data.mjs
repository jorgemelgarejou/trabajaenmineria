// Categorías de cursos para /cursos. Texto propio y orientativo: los requisitos exactos los define
// cada empresa, CONASET/municipalidad (licencias), la SEC (electricidad) o la autoridad que corresponda.
// "cargos" enlaza cada categoría con los perfiles de /recursos/<slug>.
export const CURSOS_CATS = [
  {
    id: "licencias", nombre: "Licencias de conducir profesionales", icono: "🚛",
    intro: "La licencia es el requisito que más se repite en las ofertas de operadores y conductores. Sin ella, muchas postulaciones se descartan en el primer filtro.",
    cargos: ["operador-de-equipos", "conductor-y-chofer", "bodega-y-logistica", "sin-experiencia"],
    cursos: [
      { nombre: "Licencia clase D", para: "Operar maquinaria automotriz: cargadores, retroexcavadoras, motoniveladoras, grúas horquilla.", duracion: "Curso teórico-práctico y examen municipal." },
      { nombre: "Licencia A4 / A5", para: "Conducir camiones de carga (A5 incluye vehículos articulados).", duracion: "Escuela de conductores profesionales; exige años previos con licencia B." },
      { nombre: "Licencia A2 / A3", para: "Transporte de personal en furgones y buses.", duracion: "Escuela de conductores profesionales." },
      { nombre: "Manejo defensivo y 4x4", para: "Conducir camionetas en caminos mineros y faenas.", duracion: "Curso corto, normalmente de 1 o 2 días." },
    ],
  },
  {
    id: "seguridad", nombre: "Seguridad y prevención", icono: "🦺",
    intro: "Son cursos cortos que casi todas las faenas piden o valoran. Suman puntos en cualquier cargo, con o sin experiencia.",
    cargos: ["sin-experiencia", "mantenedor-mecanico", "electrico-e-instrumentista", "soldador", "operador-de-equipos", "prevencionista-de-riesgos", "supervisor-y-jefatura"],
    cursos: [
      { nombre: "Trabajo en altura física", para: "Uso de arnés y líneas de vida en estructuras, plantas y montaje.", duracion: "Habitualmente 8 a 16 horas." },
      { nombre: "Aislamiento y bloqueo de energías", para: "Mantención segura de equipos (LOTO). Muy pedido en mantención y electricidad.", duracion: "Curso corto." },
      { nombre: "Espacios confinados", para: "Trabajo en estanques, chutes, ductos y buzones.", duracion: "Curso corto." },
      { nombre: "Primeros auxilios y uso de extintores", para: "Base para cualquier cargo en faena.", duracion: "Curso corto." },
      { nombre: "Prevención de riesgos y sistemas de gestión", para: "Para prevencionistas y supervisores: normativa, investigación de incidentes, ISO 45001.", duracion: "Diplomados y cursos de especialización." },
    ],
  },
  {
    id: "oficios", nombre: "Oficios y equipos", icono: "🛠️",
    intro: "Certificaciones técnicas que abren cargos mejor pagados en mantención, izaje y montaje.",
    cargos: ["mantenedor-mecanico", "electrico-e-instrumentista", "soldador", "operador-de-equipos", "bodega-y-logistica"],
    cursos: [
      { nombre: "Rigger y señalero de grúa", para: "Izaje de cargas, maniobras y comunicación con el operador de grúa.", duracion: "Curso con evaluación práctica." },
      { nombre: "Operador de grúa horquilla y puente grúa", para: "Bodegas, talleres y plantas.", duracion: "Curso corto + licencia D para grúa horquilla en vías." },
      { nombre: "Soldadura certificada", para: "Soldadores calificados según norma y proceso (SMAW, GMAW, TIG).", duracion: "Formación técnica + calificación." },
      { nombre: "Hidráulica y neumática", para: "Mantención de equipos mineros y plantas.", duracion: "Cursos técnicos de distinta duración." },
      { nombre: "Electricidad con autorización SEC", para: "Instaladores eléctricos. La autorización la entrega la Superintendencia de Electricidad y Combustibles.", duracion: "Según clase de autorización." },
    ],
  },
  {
    id: "seguridad-privada", nombre: "Guardia y vigilancia", icono: "🛡️",
    intro: "Una de las puertas de entrada más comunes a la faena para quienes no tienen experiencia minera.",
    cargos: ["sin-experiencia"],
    cursos: [
      { nombre: "Curso OS-10 de guardia de seguridad", para: "Requisito para trabajar como guardia o rondín. Debe estar vigente.", duracion: "Curso de formación y reentrenamiento periódico." },
    ],
  },
  {
    id: "mineria", nombre: "Formación minera y operación", icono: "⛏️",
    intro: "Cursos y programas orientados a operar equipos y entender los procesos de la mina y la planta.",
    cargos: ["operador-de-equipos", "sin-experiencia", "geologo-y-topografo", "ingeniero", "supervisor-y-jefatura"],
    cursos: [
      { nombre: "Operador de equipos mineros (con simulador)", para: "Camión de extracción, cargador, bulldozer. Algunas OTEC trabajan con simuladores.", duracion: "Programas de semanas a meses." },
      { nombre: "Programas de formación de mineras", para: "Cupos para personas sin experiencia, generalmente para operadores y mantenedores.", duracion: "Se publican en los portales de empleo de cada empresa." },
      { nombre: "Topografía, GPS y software minero", para: "Topógrafos, geólogos e ingenieros de planificación.", duracion: "Cursos técnicos y de software." },
    ],
  },
];
