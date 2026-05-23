export const startupDataset = {
	company: {
		stage: "Series A",
		product: "AI productivity/API platform",
		ageYears: 2,
		employees: 28,
		fundingRaisedUsd: 4000000,
		currentCashUsd: 1200000,
	},
	monthlySnapshots: [
		{
			month: "Jan",
			mau: 42000,
			dau: 8000,
			revenueUsd: 38000,
			cloudSpendUsd: 14000,
		},
		{
			month: "Feb",
			mau: 57000,
			dau: 11000,
			revenueUsd: 49000,
			cloudSpendUsd: 19000,
		},
		{
			month: "Mar",
			mau: 81000,
			dau: 16000,
			revenueUsd: 71000,
			cloudSpendUsd: 31000,
		},
		{
			month: "Apr",
			mau: 120000,
			dau: 24000,
			revenueUsd: 102000,
			cloudSpendUsd: 54000,
		},
		{
			month: "May",
			mau: 190000,
			dau: 38000,
			revenueUsd: 146000,
			cloudSpendUsd: 97000,
		},
	],
	cloudSpendBreakdown: {
		computeGpuUsd: 58000,
		databasesUsd: 11000,
		storageUsd: 6000,
		bandwidthCdnUsd: 9000,
		observabilityLoggingUsd: 4000,
		aiApisUsd: 7000,
		miscInfraUsd: 2000,
	},
	productMetrics: {
		mau: 190000,
		dau: 38000,
		payingCustomers: 3100,
		conversionRatePct: 1.6,
		churnPct: 4.2,
		requestsPerMonth: 420000000,
		avgRequestsPerDauPerDay: 370,
		avgSessionDurationMinutes: 14,
	},
	businessMetrics: {
		mrrUsd: 146000,
		arrUsd: 1752000,
		revenueGrowthPct: 43,
		grossMarginPct: 33.6,
		payrollUsd: 182000,
		marketingSpendUsd: 48000,
		saasToolsUsd: 12000,
		monthlyOperatingCostsUsd: 339000,
		netBurnUsd: 193000,
		runwayMonths: 6.2,
	},
	dangerScenarios: [
		{
			id: "traffic-spike",
			label: "+600% MAU in 2 weeks",
			mauMultiplier: 7,
			expectedCloudSpendUsd: 290000,
			expectedNetBurnUsd: 353000,
			runwayMonths: 3.4,
			notes: [
				"GPU spend expands fastest under inference-heavy traffic.",
				"CDN and database scaling rise before Stripe revenue catches up.",
				"Runway drops from 6.2 months to about 3.4 months.",
			],
		},
	],
} as const;

export const latestStartupSnapshot =
	startupDataset.monthlySnapshots[startupDataset.monthlySnapshots.length - 1];

export const startupDashboardData = {
	currentBalance: startupDataset.company.currentCashUsd,
	monthlyRevenue: startupDataset.businessMetrics.mrrUsd,
	monthlyExpenses: startupDataset.businessMetrics.monthlyOperatingCostsUsd,
	netBurn: startupDataset.businessMetrics.netBurnUsd,
	runway: startupDataset.businessMetrics.runwayMonths,
	cloudExpenses: startupDataset.cloudSpendBreakdown,
	revenueStreams: {
		subscriptions: 104000,
		usage: 42000,
	},
	monthlyTrend: startupDataset.monthlySnapshots.map((snapshot) => ({
		month: snapshot.month,
		revenue: snapshot.revenueUsd / 1000,
		expenses:
			(snapshot.cloudSpendUsd +
				startupDataset.businessMetrics.payrollUsd +
				startupDataset.businessMetrics.marketingSpendUsd +
				startupDataset.businessMetrics.saasToolsUsd) /
			1000,
		cloud: snapshot.cloudSpendUsd / 1000,
	})),
	projectedCosts: [
		{
			month: "May",
			computeGpu: 58,
			databases: 11,
			storage: 6,
			bandwidthCdn: 9,
			observability: 4,
			aiApis: 7,
			miscInfra: 2,
		},
		{
			month: "Jun",
			computeGpu: 72,
			databases: 14,
			storage: 7,
			bandwidthCdn: 12,
			observability: 5,
			aiApis: 9,
			miscInfra: 3,
		},
		{
			month: "Jul",
			computeGpu: 89,
			databases: 18,
			storage: 8,
			bandwidthCdn: 16,
			observability: 6,
			aiApis: 12,
			miscInfra: 3,
		},
		{
			month: "Aug",
			computeGpu: 110,
			databases: 22,
			storage: 10,
			bandwidthCdn: 20,
			observability: 7,
			aiApis: 15,
			miscInfra: 4,
		},
		{
			month: "Sep",
			computeGpu: 136,
			databases: 27,
			storage: 12,
			bandwidthCdn: 25,
			observability: 9,
			aiApis: 19,
			miscInfra: 5,
		},
		{
			month: "Spike",
			computeGpu: 180,
			databases: 34,
			storage: 17,
			bandwidthCdn: 31,
			observability: 12,
			aiApis: 12,
			miscInfra: 4,
		},
	],
};

export function buildStartupDatasetContext() {
	const cloudBreakdown = Object.entries(startupDataset.cloudSpendBreakdown)
		.map(([key, value]) => `- ${humanizeKey(key)}: ${formatUsd(value)}`)
		.join("\n");
	const snapshots = startupDataset.monthlySnapshots
		.map(
			(snapshot) =>
				`- ${snapshot.month}: MAU ${formatNumber(snapshot.mau)}, DAU ${formatNumber(snapshot.dau)}, revenue ${formatUsd(snapshot.revenueUsd)}, cloud spend ${formatUsd(snapshot.cloudSpendUsd)}`,
		)
		.join("\n");
	const scenario = startupDataset.dangerScenarios[0];

	return `Startup dataset:
- Stage: ${startupDataset.company.stage}
- Product: ${startupDataset.company.product}
- Age: ${startupDataset.company.ageYears} years
- Employees: ${startupDataset.company.employees}
- Funding raised: ${formatUsd(startupDataset.company.fundingRaisedUsd)}
- Current cash: ${formatUsd(startupDataset.company.currentCashUsd)}

Monthly snapshots:
${snapshots}

Current product metrics:
- MAU: ${formatNumber(startupDataset.productMetrics.mau)}
- DAU: ${formatNumber(startupDataset.productMetrics.dau)}
- Paying customers: ${formatNumber(startupDataset.productMetrics.payingCustomers)}
- Conversion rate: ${startupDataset.productMetrics.conversionRatePct}%
- Churn: ${startupDataset.productMetrics.churnPct}%
- Requests/month: ${formatNumber(startupDataset.productMetrics.requestsPerMonth)}
- Avg requests per DAU/day: ${startupDataset.productMetrics.avgRequestsPerDauPerDay}
- Avg session duration: ${startupDataset.productMetrics.avgSessionDurationMinutes} minutes

Current business metrics:
- MRR: ${formatUsd(startupDataset.businessMetrics.mrrUsd)}
- ARR: ${formatUsd(startupDataset.businessMetrics.arrUsd)}
- Revenue growth: ${startupDataset.businessMetrics.revenueGrowthPct}%
- Gross margin: ${startupDataset.businessMetrics.grossMarginPct}% when total cloud spend is treated as COGS
- Payroll: ${formatUsd(startupDataset.businessMetrics.payrollUsd)}/month
- Marketing spend: ${formatUsd(startupDataset.businessMetrics.marketingSpendUsd)}/month
- SaaS tools: ${formatUsd(startupDataset.businessMetrics.saasToolsUsd)}/month
- Total monthly operating costs: ${formatUsd(startupDataset.businessMetrics.monthlyOperatingCostsUsd)}
- Net burn: ${formatUsd(startupDataset.businessMetrics.netBurnUsd)}/month
- Runway: ${startupDataset.businessMetrics.runwayMonths} months

Cloud spend breakdown:
${cloudBreakdown}

Danger scenario:
- ${scenario.label}: cloud spend rises to about ${formatUsd(scenario.expectedCloudSpendUsd)}, net burn rises to about ${formatUsd(scenario.expectedNetBurnUsd)}/month, runway falls to about ${scenario.runwayMonths} months.`;
}

function humanizeKey(key: string) {
	return key
		.replace(/Usd$/, "")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNumber(value: number) {
	return new Intl.NumberFormat("en-US").format(value);
}

function formatUsd(value: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(value);
}
