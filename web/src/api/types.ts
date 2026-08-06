export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
}

export interface LoginOption {
  id: string;
  username: string;
  displayName: string;
}

export interface Printer {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  machineCostMode: string;
  manualHourlyRateGs: number | null;
  isActive: boolean;
}

export interface EnergyProfile {
  id: string;
  printerId: string;
  name: string;
  materialFamily: string;
  averagePrintPowerW: number;
  idlePowerW: number;
  maxPowerW: number;
}

export interface ElectricityTariff {
  id: string;
  provider: string;
  name: string;
  baseRateGsPerKWh: number;
  isActive: boolean;
}

export interface Filament {
  id: string;
  manufacturer: string;
  productName: string;
  material: string;
  color: string;
  landedCostGs: number;
  netWeightGrams: number;
  remainingWeightGrams: number;
  isActive: boolean;
}

export interface PricingPolicy {
  id: string;
  name: string;
  targetMarginPercent: number;
  minimumMarginPercent: number;
  minimumOrderGs: number;
  roundingIncrementGs: number;
  failureProbability: number;
  isDefault: boolean;
}

export interface QuoteBreakdown {
  quantity: number;
  numberOfPlates: number;
  materialCostGs: number;
  energy: { totalKWh: number; costGs: number; effectiveRateGsPerKWh: number; usedMeasuredKWh: boolean };
  machine: { hourlyRateGs: number; totalOccupiedHours: number; costGs: number; isConfigured: boolean };
  laborCostGs: number;
  additionalCostGs: number;
  directCostGs: number;
  failureReserveGs: number;
  totalOverheadGs: number;
  fullyLoadedCostGs: number;
  suggestedNetPriceGs: number;
  finalNetSalePriceGs: number;
  estimatedProfitGs: number;
  achievedMarginPercent: number;
  markupPercent: number;
  taxGs: number;
  customerTotalGs: number;
  unitCostGs: number;
  unitPriceGs: number;
  warnings: string[];
}

export interface QuotePreviewResponse {
  snapshot: Record<string, unknown>;
  breakdown: QuoteBreakdown;
}

export interface QuoteSummary {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  totalGs: number;
  revisionNumber: number;
}

export interface JobSummary {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  estimatedTotalGs: number;
  actualCostGs: number | null;
}

