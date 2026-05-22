export type ServiceLine = {
	name: string;
	count: string;
	spend: string;
	spendAmount?: number;
	previousSpendAmount?: number;
	trend: string;
	trendPct?: number | null;
	isEstimated?: boolean;
	detail: string;
};

export type ProviderSource = {
	kind: string;
	label: string;
	generatedAt: string;
	billingPeriod: {
		start: string;
		endExclusive: string;
	};
	warnings: string[];
};

export type ProviderMock = {
	provider?: string;
	headline: string;
	monthlySpend?: string;
	previousSpend?: string;
	trend?: string;
	monthlyIn?: string;
	monthlyOut?: string;
	net?: string;
	currency?: string;
	costActual?: {
		amount: number;
		previousAmount: number;
		trendPct: number | null;
		isEstimated: boolean;
	};
	source?: ProviderSource;
	services: ServiceLine[];
	events: string[];
};

export type CloudForecastPoint = {
	label: string;
	baseline: number;
	optimized: number;
	runRate: number;
};

export type CloudScenario = {
	id: string;
	prompt: string;
	headline: string;
	summary: string;
	numbers: Array<[string, string]>;
	risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	keyRisk: string;
	recommendations: string[];
	confidence: number;
	basedOn: string[];
	metrics: {
		infraCost: string;
		forecast: string;
		savings: string;
		confidence: string;
	};
	chart: CloudForecastPoint[];
};

export type CloudPricingLineItem = {
	provider: string;
	service: string;
	sku: string;
	description: string;
	quantity: number;
	quantityUnit: string;
	unit: string;
	unitPriceUsd: number;
	monthlyCostUsd: number;
	sourceUrl: string;
	sourceType: string;
	notes: string;
};

export type CloudPricingServiceEstimate = {
	provider: string;
	service: string;
	monthlyCostUsd: number;
};

export type CloudPricingCatalogueItem = {
	provider: string;
	service: string;
	sku: string;
	description: string;
	region: string;
	unit: string;
	unitPriceUsd: number | null;
	currency: string;
	status: string;
	sourceUrl: string;
	sourceType: string;
	metadata: Record<string, unknown>;
};

export type CloudPricingCatalogue = {
	schemaVersion: number;
	kind: "public_cloud_pricing_catalogue";
	generatedAt: string;
	currency: "USD";
	sourcePolicy: string;
	regions: Record<string, string>;
	items: CloudPricingCatalogueItem[];
	warnings: string[];
	sourceNotes: string[];
};

export type CloudPricingInputs = {
	schemaVersion: number;
	currency: "USD";
	applyFreeTier: boolean;
	regions: Record<string, string>;
	providers: Record<string, unknown>;
	usage: Record<string, Record<string, number | string>>;
};

export type CloudBudgetForecast = {
	schemaVersion: number;
	kind?: string;
	generatedAt: string;
	currency: "USD";
	sourcePolicy?: string;
	horizonMonths: number;
	input?: unknown;
	summary: {
		currentMonthlyCost: number;
		previousMonthlyCost: number;
		trendPct: number;
		nextMonthForecast: number;
		sixMonthForecastTotal: number;
		optimizedSixMonthTotal: number;
		actualCoveragePct: number;
		estimatedCoveragePct: number;
		risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	};
	providers: Array<{
		id: string;
		label: string;
		currentAmount: number;
		runRateAmount: number;
		previousAmount: number;
		trendPct: number | null;
		isEstimated: boolean;
		sourceKind: string;
		warnings: string[];
	}>;
	sourceRows: Array<[string, string, string]>;
	monthlyBudget: Array<{
		month: string;
		label: string;
		cloud: number;
		baseline: number;
		optimized: number;
		runRate: number;
		isActual: boolean;
		estimatedPct: number;
	}>;
	serviceSpend: Array<{
		label: string;
		value: number;
		color: string;
		isEstimated: boolean;
		sourceKind: string;
	}>;
	chart: CloudForecastPoint[];
	scenarios: CloudScenario[];
	warnings: string[];
	estimateRows?: CloudPricingServiceEstimate[];
	lineItems?: CloudPricingLineItem[];
	unpricedItems?: string[];
	catalogue?: {
		itemsCount: number;
		pricedLineItems: number;
		unpricedLineItems: number;
	};
};
