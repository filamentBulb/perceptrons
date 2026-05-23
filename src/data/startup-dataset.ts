export const startupDataset = {
	company: {
		stage: "Series A",
		product: "AI productivity/API platform",
		ageYears: 2,
		employees: 28,
		fundingRaisedUsd: 1800000,
		currentCashUsd: 1380000,
	},
	fundingRounds: [
		{
			month: "Mar",
			type: "Series A",
			amountUsd: 1800000,
			leadInvestor: "Northstar Ventures",
			notes:
				"Primary financing used for hiring, GPU capacity, and enterprise sales.",
		},
	],
	monthlySnapshots: [
		{
			month: "Jan",
			mau: 42000,
			dau: 8000,
			revenueUsd: 38000,
			cloudSpendUsd: 14000,
			aiTokenSpendUsd: 2600,
			aiTokensUsed: 18400000,
			fundingUsd: 0,
		},
		{
			month: "Feb",
			mau: 57000,
			dau: 11000,
			revenueUsd: 49000,
			cloudSpendUsd: 19000,
			aiTokenSpendUsd: 4100,
			aiTokensUsed: 29100000,
			fundingUsd: 0,
		},
		{
			month: "Mar",
			mau: 81000,
			dau: 16000,
			revenueUsd: 71000,
			cloudSpendUsd: 31000,
			aiTokenSpendUsd: 6800,
			aiTokensUsed: 48600000,
			fundingUsd: 1800000,
		},
		{
			month: "Apr",
			mau: 120000,
			dau: 24000,
			revenueUsd: 102000,
			cloudSpendUsd: 54000,
			aiTokenSpendUsd: 10400,
			aiTokensUsed: 74200000,
			fundingUsd: 0,
		},
		{
			month: "May",
			mau: 190000,
			dau: 38000,
			revenueUsd: 146000,
			cloudSpendUsd: 97000,
			aiTokenSpendUsd: 16700,
			aiTokensUsed: 121000000,
			fundingUsd: 0,
		},
	],
	aiTokenUsage: {
		totalTokens: 121000000,
		totalCostUsd: 16700,
		tokensPerEmployee: 4321429,
		costPerEmployeeUsd: 596,
		services: [
			{
				id: "openai",
				name: "OpenAI",
				modelMix: "GPT-4.1, GPT-4o mini, embeddings",
				tokensUsed: 86000000,
				costUsd: 11800,
				trendPct: 39,
				usage: "Customer copilots, CFO chat drafts, embeddings",
			},
			{
				id: "anthropic",
				name: "Anthropic",
				modelMix: "Claude Sonnet, Claude Haiku",
				tokensUsed: 35000000,
				costUsd: 4900,
				trendPct: 31,
				usage: "Long-context analysis, finance memo generation",
			},
		],
	},
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
		aiTokenSpendUsd: 16700,
		monthlyOperatingCostsUsd: 355700,
		netBurnUsd: 209700,
		runwayMonths: 6.6,
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
				"Runway drops from 6.6 months to about 3.4 months.",
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
	aiTokenUsage: startupDataset.aiTokenUsage,
	revenueStreams: {
		subscriptions: 104000,
		usage: 42000,
	},
	monthlyTrend: startupDataset.monthlySnapshots.map((snapshot) => ({
		month: snapshot.month,
		revenue: snapshot.revenueUsd / 1000,
		funding: (snapshot.fundingUsd ?? 0) / 1000,
		totalCashIn: (snapshot.revenueUsd + (snapshot.fundingUsd ?? 0)) / 1000,
		expenses:
			(snapshot.cloudSpendUsd +
				snapshot.aiTokenSpendUsd +
				startupDataset.businessMetrics.payrollUsd +
				startupDataset.businessMetrics.marketingSpendUsd +
				startupDataset.businessMetrics.saasToolsUsd) /
			1000,
		cloud: snapshot.cloudSpendUsd / 1000,
		aiTokens: snapshot.aiTokensUsed / 1000000,
		aiTokenCost: snapshot.aiTokenSpendUsd / 1000,
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
			openAi: 11.8,
			anthropic: 4.9,
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
			openAi: 14.9,
			anthropic: 6.2,
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
			openAi: 18.7,
			anthropic: 7.8,
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
			openAi: 23.3,
			anthropic: 9.8,
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
			openAi: 29.1,
			anthropic: 12.2,
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
			openAi: 44.0,
			anthropic: 18.6,
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
				`- ${snapshot.month}: MAU ${formatNumber(snapshot.mau)}, DAU ${formatNumber(snapshot.dau)}, revenue ${formatUsd(snapshot.revenueUsd)}, funding ${formatUsd(snapshot.fundingUsd ?? 0)}, cloud spend ${formatUsd(snapshot.cloudSpendUsd)}`,
		)
		.join("\n");
	const aiTokenServices = startupDataset.aiTokenUsage.services
		.map(
			(service) =>
				`- ${service.name}: ${formatNumber(service.tokensUsed)} tokens, ${formatUsd(service.costUsd)}/month, ${service.trendPct}% growth; ${service.usage}; model mix: ${service.modelMix}`,
		)
		.join("\n");
	const fundingRounds = startupDataset.fundingRounds
		.map(
			(round) =>
				`- ${round.month} ${round.type}: ${formatUsd(round.amountUsd)} led by ${round.leadInvestor}; ${round.notes}`,
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

Funding rounds:
${fundingRounds}

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

AI token usage:
- Total tokens: ${formatNumber(startupDataset.aiTokenUsage.totalTokens)}/month
- Total AI token cost: ${formatUsd(startupDataset.aiTokenUsage.totalCostUsd)}/month
- Tokens per employee: ${formatNumber(startupDataset.aiTokenUsage.tokensPerEmployee)}/month
- AI token cost per employee: ${formatUsd(startupDataset.aiTokenUsage.costPerEmployeeUsd)}/month
${aiTokenServices}

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
