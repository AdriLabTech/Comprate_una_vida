// Tarifas de vida. El precio SIEMPRE se resuelve aquí (servidor): el cliente solo envía el id.
// Importes en céntimos, IVA incluido, para no arrastrar errores de coma flotante.
export const TARIFAS = [
  { id: 'basica', nota: 'Incluye respiración básica. Los lunes se sirven con anuncios.', nombre: 'Vida Básica',   centimos: 99,       periodo: 'mes',   lema: 'Respirar incluido. Los lunes, con anuncios.' },
  { id: 'estandar', nota: 'Café incluido (el segundo café se factura aparte).', nombre: 'Vida Estándar', centimos: 299,      periodo: 'mes',   lema: 'Fines de semana sin ruido. Café incluido.' },
  { id: 'premium', nota: 'Los lunes quedan eliminados del calendario del cliente.', nombre: 'Vida Premium',  centimos: 499,     periodo: 'mes',   lema: 'Sin lunes. Siestas ilimitadas.' },
  { id: 'platinum', nota: 'WiFi garantizado. Las reclamaciones, directamente al router.', nombre: 'Vida Platinum', centimos: 999,    periodo: 'mes',   lema: 'Todo lo anterior. Y el WiFi nunca falla.' },
  { id: 'eterna', nota: 'No admite devoluciones, ni siquiera con el ticket.', nombre: 'Vida Eterna',   centimos: 4999,  periodo: 'único', lema: 'Sin permanencia. Literalmente.' },
];

export const IVA = 0.21;

export function buscarTarifa(id) {
  return TARIFAS.find((t) => t.id === id) ?? null;
}

const formato = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
export function euros(centimos) {
  return formato.format(centimos / 100);
}

// Desglose: el precio publicado lleva IVA; la base se calcula en céntimos enteros.
export function desglose(centimos) {
  const base = Math.round(centimos / (1 + IVA));
  return { base, iva: centimos - base, total: centimos };
}
