import type { QuoteMaterialSelection } from '../api/types';

export function usesBaseGrams(material?: QuoteMaterialSelection) {
  return material?.slicerTotalGrams == null && material?.baseGrams != null;
}

export function editableGrams(material?: QuoteMaterialSelection) {
  if (!material) return 0;
  return material.slicerTotalGrams ?? material.baseGrams ??
    ((material.modelGrams ?? 0) + (material.supportGrams ?? 0) + (material.purgeGrams ?? 0) +
      (material.primeTowerGrams ?? 0) + (material.adhesionGrams ?? 0) + (material.otherWasteGrams ?? 0));
}

export function selectQuoteMaterial(spoolId: string, grams: number, original?: QuoteMaterialSelection): QuoteMaterialSelection {
  if (original && editableGrams(original) === grams) return { ...original, spoolId };
  return usesBaseGrams(original) ? { ...original, spoolId, baseGrams: grams }
    : { ...original, spoolId, slicerTotalGrams: grams };
}
