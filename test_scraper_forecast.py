import unittest
from copy import deepcopy
from datetime import date

import scraper


class ScraperForecastTests(unittest.TestCase):
	def test_month_windows_use_exclusive_current_end(self):
		windows = scraper.month_windows(2, today=date(2026, 5, 22))

		self.assertEqual(windows[0]["key"], "2026-04")
		self.assertEqual(windows[0]["endExclusive"], "2026-05-01")
		self.assertTrue(windows[0]["isClosed"])
		self.assertEqual(windows[1]["key"], "2026-05")
		self.assertEqual(windows[1]["endExclusive"], "2026-05-23")
		self.assertFalse(windows[1]["isClosed"])

	def test_forecast_windows_start_current_month(self):
		windows = scraper.forecast_month_windows(3, today=date(2026, 5, 22))

		self.assertEqual([item["key"] for item in windows], ["2026-05", "2026-06", "2026-07"])
		self.assertTrue(windows[0]["isCurrent"])
		self.assertFalse(windows[1]["isCurrent"])

	def test_normalized_run_rate_only_for_month_to_date_periods(self):
		month_to_date_payload = {
			"source": {
				"billingPeriod": {
					"start": "2026-05-01",
					"endExclusive": "2026-05-23",
				}
			}
		}
		full_month_payload = {
			"source": {
				"billingPeriod": {
					"start": "2026-05-01",
					"endExclusive": "2026-06-01",
				}
			}
		}

		self.assertAlmostEqual(
			scraper.normalized_run_rate(month_to_date_payload, 220, today=date(2026, 5, 22)),
			310,
		)
		self.assertEqual(
			scraper.normalized_run_rate(full_month_payload, 220, today=date(2026, 5, 22)),
			220,
		)

	def test_legacy_provider_data_is_not_treated_as_actual(self):
		forecast = scraper.build_cloud_forecast(
			{
				"aws": {
					"monthlySpend": "$1,000/mo",
					"previousSpend": "$900/mo",
					"services": [],
					"events": [],
				}
			},
			today=date(2026, 5, 22),
		)

		self.assertEqual(forecast["summary"]["actualCoveragePct"], 0)
		self.assertEqual(forecast["summary"]["estimatedCoveragePct"], 100)
		self.assertEqual(forecast["providers"][0]["sourceKind"], "legacy_unverified")

	def test_public_pricing_estimate_uses_catalogue_prices(self):
		config = deepcopy(scraper.DEFAULT_PUBLIC_PRICING_INPUTS)
		config["usage"]["compute"]["hoursPerMonth"] = 10
		config["usage"]["compute"]["instanceCount"] = 2
		catalogue = {
			"items": [
				scraper._catalog_item(
					provider="aws",
					service="EC2",
					sku="t3.medium",
					description="fixture EC2 price",
					region="eu-central-1",
					unit="hour",
					unit_price_usd=0.05,
					source_url="https://pricing.us-east-1.amazonaws.com/fixture",
					source_type="fixture",
				)
			],
			"warnings": [],
		}

		estimate = scraper.build_public_pricing_estimates(catalogue, config)
		ec2_line = next(
			line
			for line in estimate["lineItems"]
			if line["provider"] == "aws" and line["service"] == "EC2"
		)

		self.assertEqual(ec2_line["quantity"], 20)
		self.assertAlmostEqual(ec2_line["monthlyCostUsd"], 1.0)
		self.assertIn("gcp/Compute Engine/e2-medium", estimate["unpricedItems"][0])

	def test_public_pricing_missing_sku_is_unpriced_not_fake(self):
		estimate = scraper.build_public_pricing_estimates(
			{"items": [], "warnings": []},
			deepcopy(scraper.DEFAULT_PUBLIC_PRICING_INPUTS),
		)

		self.assertEqual(estimate["summary"]["currentMonthlyCost"], 0)
		self.assertEqual(estimate["catalogue"]["pricedLineItems"], 0)
		self.assertGreater(estimate["catalogue"]["unpricedLineItems"], 0)

	def test_gcp_price_parser_combines_units_and_nanos(self):
		price = scraper._gcp_price_from_sku({
			"pricingInfo": [
				{
					"pricingExpression": {
						"usageUnit": "h",
						"tieredRates": [
							{"unitPrice": {"units": "1", "nanos": 250000000}}
						],
					}
				}
			]
		})

		self.assertEqual(price, (1.25, "h"))


if __name__ == "__main__":
	unittest.main()
