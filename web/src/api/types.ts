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
  voltage: number;
  machineCostMode: 'UsefulLifeDepreciation' | 'TargetRecoveryPeriod' | 'ManualHourlyRate';
  purchaseCostGs: number | null;
  residualValueGs: number;
  usefulLifeHours: number | null;
  expectedLifetimeRepairCostGs: number;
  maintenanceReserveGsPerHour: number;
  recoveryYears: number | null;
  businessDaysPerYear: number | null;
  plannedBillableHoursPerDay: number | null;
  repairReserveGsPerHour: number;
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
  warmupKWh: number;
  accessoryKWh: number;
  sourceName: string | null;
  verifiedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
}

export interface ElectricityTariff {
  id: string;
  provider: string;
  name: string;
  category: string;
  baseRateGsPerKWh: number;
  excludesTax: boolean;
  additionalChargesPercent: number;
  explicitEffectiveRateGsPerKWh: number | null;
  sourceName: string | null;
  verifiedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
}

export interface Filament {
  id: string;
  manufacturer: string;
  productName: string;
  material: string;
  color: string;
  batchCode: string | null;
  purchaseCurrency: string;
  purchaseAmount: number;
  exchangeRateGs: number | null;
  allocatedShippingGs: number;
  allocatedImportFeesGs: number;
  allocatedOtherCostsGs: number;
  landedCostGs: number;
  netWeightGrams: number;
  remainingWeightGrams: number;
  purchasedAt: string | null;
  supplier: string | null;
  isInventoryTracked: boolean;
  isActive: boolean;
}

export interface PricingPolicy {
  id: string;
  name: string;
  targetMarginPercent: number;
  minimumMarginPercent: number;
  minimumOrderGs: number;
  roundingIncrementGs: number;
  roundUp: boolean;
  failureMode: 'ExpectedAttempts' | 'SimplePercentage';
  failureProbability: number;
  simpleFailureReservePercent: number;
  fixedOverheadPerOrderGs: number;
  overheadPercent: number;
  monthlyOverheadGs: number;
  expectedMonthlyProductiveHours: number;
  defaultLaborRateGsPerHour: number | null;
  variableSellingFeePercent: number;
  fixedSellingFeeGs: number;
  isDefault: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

export interface ApplicationSettings {
  id: string;
  visibleAppName: string;
  timeZone: string;
  productionHostname: string | null;
  taxEnabled: boolean;
  taxName: string | null;
  taxRatePercent: number;
  priceIncludesTax: boolean;
  defaultPrinterId: string | null;
  defaultElectricityTariffId: string | null;
  defaultPricingPolicyId: string | null;
  defaultQuickSetupMinutes: number | null;
  defaultQuickPackagingCostGs: number | null;
}

export interface SettingsResponse {
  settings: ApplicationSettings;
  readiness: Record<string, boolean>;
}

export interface PriceWarning {
  code: string;
  message: string;
  field: string | null;
  blocksPrice: boolean;
}

export interface ResolvedQuoteAssumptions {
  printerId: string;
  printerName: string;
  energyProfileId: string;
  energyProfileName: string;
  materialFamily: string;
  electricityTariffId: string;
  electricityTariffName: string;
  pricingPolicyId: string;
  pricingPolicyName: string;
  printDurationHours: number;
  occupiedPrinterHours: number;
  setupLaborMinutes: number;
  packagingCostGs: number;
  tax: { enabled: boolean; name: string | null; ratePercent: number; priceIncludesTax: boolean };
}

export interface QuoteBreakdown {
  quantity: number;
  numberOfPlates: number;
  materialCostGs: number;
  materials: Array<{ spoolId: string | null; costPerGramGs: number; totalChargeableGrams: number; costGs: number }>;
  energy: { totalKWh: number; costGs: number; effectiveRateGsPerKWh: number; usedMeasuredKWh: boolean };
  machine: { hourlyRateGs: number; totalOccupiedHours: number; costGs: number; isConfigured: boolean };
  laborCostGs: number;
  additionalCostGs: number;
  marginBearingAdditionalCostGs: number;
  nonMarginInternalCostGs: number;
  nonMarginRecoveryChargeGs: number;
  customerAdditionalChargeGs: number;
  customerPassThroughGs: number;
  directCostGs: number;
  failureReserveGs: number;
  totalOverheadGs: number;
  fullyLoadedCostGs: number;
  requiredNetPriceGs: number;
  minimumMarginPriceGs: number;
  suggestedNetPriceGs: number;
  finalNetSalePriceGs: number;
  variableSellingFeeGs: number;
  netRevenueAfterSellingFeesGs: number;
  revenueAvailableBeforeCostsGs: number;
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
  resolvedAssumptions: ResolvedQuoteAssumptions;
  canUsePrice: boolean;
  warnings: PriceWarning[];
}

export interface QuickQuotePreviewResponse {
  breakdown: QuoteBreakdown | null;
  resolvedAssumptions: ResolvedQuoteAssumptions | null;
  canUsePrice: boolean;
  warnings: PriceWarning[];
  advancedRequest: Record<string, unknown> | null;
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
