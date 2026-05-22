import type { ProviderMock } from "#/lib/provider-types";
import {
	cloudPricingLineItems,
	cloudPricingProviderTotals,
	formatPricingUsd,
} from "./cloud-pricing";

export const realProviderData = cloudPricingProviderTotals.reduce<
	Partial<Record<string, ProviderMock>>
>((providers, provider) => {
	const lines = cloudPricingLineItems.filter(
		(line) => line.provider === provider.id,
	);
	const serviceTotals = lines.reduce<Record<string, number>>((totals, line) => {
		totals[line.service] = (totals[line.service] ?? 0) + line.monthlyCostUsd;
		return totals;
	}, {});

	providers[provider.id] = {
		provider: provider.label,
		headline: `${provider.label} public retail estimate: ${formatPricingUsd(
			provider.monthlyCostUsd,
		)}/mo`,
		monthlySpend: `${formatPricingUsd(provider.monthlyCostUsd)}/mo`,
		previousSpend: "n/a",
		trend: "public price",
		currency: "USD",
		costActual: {
			amount: provider.monthlyCostUsd,
			previousAmount: 0,
			trendPct: 0,
			isEstimated: false,
		},
		source: {
			kind: provider.sourceKind,
			label: "Official public pricing dataset",
			generatedAt: "",
			billingPeriod: {
				start: "",
				endExclusive: "",
			},
			warnings: provider.warnings,
		},
		services: Object.entries(serviceTotals)
			.sort((left, right) => right[1] - left[1])
			.map(([service, total]) => {
				const serviceLines = lines.filter((line) => line.service === service);
				return {
					name: service,
					count: `${serviceLines.length} SKU${serviceLines.length === 1 ? "" : "s"}`,
					spend: formatPricingUsd(total),
					spendAmount: total,
					previousSpendAmount: 0,
					trend: "priced",
					trendPct: 0,
					isEstimated: false,
					detail: serviceLines
						.slice(0, 2)
						.map((line) => `${line.sku} in ${line.quantityUnit}`)
						.join(", "),
				};
			}),
		events: [
			`${provider.label} uses ${lines.length} priced public SKU rows.`,
			`${provider.label} source kind: ${provider.sourceKind.replaceAll("_", " ")}`,
			`Provider total: ${formatPricingUsd(provider.monthlyCostUsd)}/mo`,
		],
	};

	return providers;
}, {});
