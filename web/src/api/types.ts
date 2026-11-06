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
  defaultEnergyProfileId: string | null;
  defaultElectricityTariffId: string | null;
  defaultPricingPolicyId: string | null;
  defaultQuickSetupMinutes: number | null;
  defaultQuickPackagingCostGs: number | null;
  brandLogo: string | null;
  brandDisplayName: string | null;
  brandContactLine: string | null;
  clientQuoteNote: string | null;
  clientQuoteValidityDays: number;
}

export interface SettingsResponse {
  settings: ApplicationSettings;
  readiness: Record<string, boolean>;
}

export interface SimplePricingSettings {
  machineHourlyRateGs: number;
  preparationMinutes: number;
  laborHourlyRateGs: number;
  preparationCostGs: number;
  packagingCostGs: number;
  failureProbabilityPercent: number;
  overheadPercent: number;
  targetMarginPercent: number;
  minimumMarginPercent: number;
  minimumOrderGs: number;
  roundingIncrementGs: number;
  averagePrintPowerW: number;
  electricityRateGsPerKWh: number;
  printerName: string;
  electricityTariffName: string;
  isUsingRecommendedDefaults: boolean;
  hasAdvancedOverrides: boolean;
  advancedOverrideMessages: string[];
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

export interface QuoteMaterialSelection {
  spoolId: string;
  modelGrams?: number;
  supportGrams?: number;
  purgeGrams?: number;
  primeTowerGrams?: number;
  adhesionGrams?: number;
  otherWasteGrams?: number;
  slicerTotalGrams?: number | null;
  baseGrams?: number | null;
  wastePercent?: number;
  wastePercentIsAdditional?: boolean;
}

export interface QuoteLaborSelection {
  category: string;
  minutes: number;
  hourlyRateGs: number | null;
  scope: 'PerUnit' | 'PerPlate' | 'FixedPerOrder' | 'FixedPerQuoteLine';
  repeatOnFailure: boolean;
}

export interface QuoteAdditionalCost {
  description: string;
  amountGs: number;
  scope: QuoteLaborSelection['scope'];
  repeatOnFailure: boolean;
  isInternalCost: boolean;
  participatesInMargin: boolean;
}

export interface QuotePreviewRequest {
  printerId: string;
  energyProfileId: string;
  electricityTariffId: string;
  pricingPolicyId: string | null;
  quantity: { quantity: number; unitsPerPlate: number; inputBasis: 'PerUnit' | 'PerPlate' };
  printDurationHours: number;
  idleDurationHours: number;
  occupiedPrinterHours: number;
  measuredKWh: number | null;
  additionalWarmupKWh: number;
  additionalAccessoryKWh: number;
  materials: QuoteMaterialSelection[];
  labor: QuoteLaborSelection[];
  additionalCosts: QuoteAdditionalCost[];
  fixedSurchargesGs: number;
  percentageSurchargePercent: number;
  discountGs: number;
  manualNetPriceGs: number | null;
  manualPriceReason: string | null;
  acceptZeroMachineRate: boolean;
  zeroMachineRateReason: string | null;
  tax: ResolvedQuoteAssumptions['tax'] | null;
  calculationContext: 'Standard' | 'QuickQuote';
  acceptStandardEnergyFallback: boolean;
}

export interface QuoteLineRequest {
  description: string;
  calculation: QuotePreviewRequest;
}

export interface QuoteLineRecord {
  id: string;
  description: string;
  request: QuotePreviewRequest;
  snapshot: Record<string, unknown>;
  breakdown: QuoteBreakdown;
  canUsePrice: boolean;
  warnings: PriceWarning[];
  production?: Record<string, unknown> | null;
  allocation?: Record<string, unknown> | null;
}

export interface QuoteAggregateBreakdown extends Omit<QuoteBreakdown, 'quantity' | 'numberOfPlates' | 'materials' | 'energy' | 'machine' | 'unitCostGs' | 'unitPriceGs'> {
  energyCostGs: number;
  machineCostGs: number;
  failureEligibleCostGs: number;
  expectedAttempts: number;
  percentageOverheadGs: number;
  hourlyOverheadRateGs: number;
  hourlyOverheadGs: number;
  totalOccupiedPrinterHours: number;
  canUsePrice: boolean;
  lineAllocations: Record<string, unknown>[];
}

export interface QuoteAggregatePreviewRequest {
  lines: QuoteLineRequest[];
}

export interface QuoteAggregatePreviewResponse {
  aggregate: { snapshot: Record<string, unknown>; breakdown: QuoteAggregateBreakdown };
  lines: QuoteLineRecord[];
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
  description: string;
  customerName: string | null;
}

export interface JobSummary {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  estimatedCustomerTotalGs: number;
  actualCustomerTotalGs: number | null;
  estimatedCostGs: number;
  actualCostGs: number | null;
  description: string;
}
