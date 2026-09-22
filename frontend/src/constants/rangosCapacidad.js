// Rangos de capacidad en intervalos de 3 (mín 1 → máx 10).
// `min`/`max` son los límites que se envían al backend; null = sin límite.
export const RANGOS_CAPACIDAD = [
  { id: "", etiqueta: "Todas", min: null, max: null },
  { id: "1-3", etiqueta: "1 – 3", min: 1, max: 3 },
  { id: "4-6", etiqueta: "4 – 6", min: 4, max: 6 },
  { id: "7-10", etiqueta: "7 – 10", min: 7, max: 10 },
];
