export function brandInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '3D';
  return words.slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('es');
}

