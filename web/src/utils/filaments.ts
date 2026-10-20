import type { Filament } from '../api/types';

export const normalizeFilamentText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
export const filamentBrand = (row: Filament) => !row.manufacturer?.trim() || ['sin fabricante', 'sin marca'].includes(normalizeFilamentText(row.manufacturer)) ? 'Sin marca' : row.manufacturer.trim();
export const filamentVariant = (row: Filament) => row.productName && ![row.color, row.material].some(value => normalizeFilamentText(value ?? '') === normalizeFilamentText(row.productName)) ? row.productName : '';
export const filamentMatches = (row: Filament, query: string) => {
  const text = normalizeFilamentText(`${filamentBrand(row)} ${row.material} ${row.color} ${row.productName ?? ''} ${row.batchCode ?? ''}`);
  return normalizeFilamentText(query).split(/\s+/).filter(Boolean).every(word => text.includes(word));
};
const colors: Record<string, string> = { blanco: '#f7f5ef', white: '#f7f5ef', negro: '#242424', black: '#242424', rojo: '#bc3039', red: '#bc3039', azul: '#3476b5', blue: '#3476b5', verde: '#32835b', green: '#32835b', amarillo: '#e3bd36', yellow: '#e3bd36', naranja: '#dc7a30', orange: '#dc7a30', gris: '#929694', gray: '#929694', grey: '#929694', rosa: '#d88ca5', pink: '#d88ca5', violeta: '#8858a2', morado: '#8858a2', purple: '#8858a2', marron: '#815d40', brown: '#815d40', dorado: '#c0a054', gold: '#c0a054', plateado: '#b2b8bd', silver: '#b2b8bd' };
export const filamentSwatches = (color: string) => [...new Set(normalizeFilamentText(color).split(/[^a-z]+/).flatMap(word => colors[word] ? [colors[word]] : []))].slice(0, 3);
