import type {
	CloudBudgetForecast,
	CloudPricingCatalogue,
	CloudPricingInputs,
	CloudPricingLineItem,
	CloudPricingServiceEstimate,
} from "#/lib/provider-types";
import catalogueJson from "./catalogue.json";
import estimateJson from "./estimate.json";
import inputsJson from "./inputs.json";

export const cloudPricingInputs = inputsJson as CloudPricingInputs;
export const cloudPricingCatalogue = catalogueJson as CloudPricingCatalogue;
export const cloudPricingEstimate = estimateJson as CloudBudgetForecast;
export const cloudBudgetForecast = cloudPricingEstimate;

export const cloudPricingLineItems = [
	...(cloudPricingEstimate.lineItems ?? []),
].sort((left, right) => right.monthlyCostUsd - left.monthlyCostUsd);

export const cloudPricingServiceEstimates = [
	...(cloudPricingEstimate.estimateRows ?? []),
].sort((left, right) => right.monthlyCostUsd - left.monthlyCostUsd);

export const cloudPricingUnpricedItems =
	cloudPricingEstimate.unpricedItems ?? [];

export const cloudPricingCatalogueItems = cloudPricingCatalogue.items;

export const cloudPricingDatasetSummary = {
	generatedAt: cloudPricingEstimate.generatedAt,
	sourcePolicy: cloudPricingEstimate.sourcePolicy ?? "official_public_sources",
	regions: cloudPricingInputs.regions,
	catalogueItems: cloudPricingCatalogue.items.length,
	pricedLineItems: cloudPricingEstimate.catalogue?.pricedLineItems ?? 0,
	unpricedLineItems: cloudPricingEstimate.catalogue?.unpricedLineItems ?? 0,
	monthlyCostUsd: cloudPricingEstimate.summary.currentMonthlyCost,
	priceCoveragePct: cloudPricingEstimate.summary.actualCoveragePct,
};

export const cloudPricingProviderTotals = cloudPricingEstimate.providers.map(
	(provider) => ({
		id: provider.id,
		label: provider.label,
		monthlyCostUsd: provider.currentAmount,
		sourceKind: provider.sourceKind,
		warnings: provider.warnings,
	}),
);

export function providerLabel(provider: string): string {
	const labels: Record<string, string> = {
		aws: "AWS",
		gcp: "GCP",
		azure: "Azure",
		cloudflare: "Cloudflare",
	};

	return labels[provider] ?? provider;
}

export function sourceLabel(sourceType: string): string {
	return sourceType.replaceAll("_", " ");
}

export function formatPricingUsd(amount: number): string {
	if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
	if (amount >= 100) return `$${amount.toFixed(0)}`;
	if (amount >= 1) return `$${amount.toFixed(2)}`;
	return `$${amount.toFixed(4)}`;
}

export function topPricingLines(limit = 8): CloudPricingLineItem[] {
	return cloudPricingLineItems.slice(0, limit);
}

export function serviceEstimatesByProvider(): Record<
	string,
	CloudPricingServiceEstimate[]
> {
	return cloudPricingServiceEstimates.reduce<
		Record<string, CloudPricingServiceEstimate[]>
	>((groups, row) => {
		groups[row.provider] = groups[row.provider] ?? [];
		groups[row.provider].push(row);
		return groups;
	}, {});
}
