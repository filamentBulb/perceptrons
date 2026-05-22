#!/usr/bin/env python3
"""
Cloud cost scraper: AWS · GCP · Azure · Cloudflare
Supports account-state scraping and public retail pricing estimates.

Required env vars per provider (missing = provider skipped):
  AWS       AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION
  GCP       GCP_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS
            optional: GCP_BILLING_BQ_DATASET (for per-service cost breakdown)
  Azure     AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID
  Cloudflare CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID

Install deps:
  pip install boto3 \
    google-cloud-billing google-cloud-compute google-cloud-run google-cloud-bigquery \
    azure-identity azure-mgmt-costmanagement azure-mgmt-resource \
    requests beautifulsoup4 lxml

Usage:
  python scraper.py            # account-state scrape → src/data/account-state/providers.json
  python scraper.py --pricing  # legacy public scrape → src/data/cloud-pricing/legacy-catalogue.json
  python scraper.py --pricing-estimates [--config path/to/inputs.json]
                               # public retail pricing → src/data/cloud-pricing/*.json

GCP API key (optional, unlocks SKU-level Cloud Billing Catalog rows):
  Any one of these works — checked in order:
    1. --gcp-api-key=KEY                (CLI flag, highest precedence)
    2. --gcp-api-key-file=PATH          (read key from a local file, no chat exposure)
    3. env GOOGLE_API_KEY / GCP_API_KEY / GCP_PUBLIC_PRICING_API_KEY /
            GCP_BILLING_CATALOG_API_KEY
    4. file .gcp_api_key in this repo   (gitignored, first non-empty line)
"""

import json
import math
import os
import re
import sys
from copy import deepcopy
from calendar import monthrange
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen


# ── formatting helpers ────────────────────────────────────────────────────────

def fmt_usd(amount: float) -> str:
    return f"${amount:,.0f}"

def fmt_usd_mo(amount: float) -> str:
    return f"${amount:,.0f}/mo"

def trend_pct(cur: float, prev: float) -> float | None:
    if prev == 0:
        return None
    return (cur - prev) / prev * 100

def fmt_trend(cur: float, prev: float) -> str:
    pct = trend_pct(cur, prev)
    if pct is None:
        return "n/a"
    return f"+{pct:.0f}%" if pct >= 0 else f"{pct:.0f}%"

def money_to_float(value: str | None) -> float:
    if not value:
        return 0.0
    match = re.search(r"-?\d+(?:,\d{3})*(?:\.\d+)?", value)
    return float(match.group(0).replace(",", "")) if match else 0.0

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def month_start(value: date) -> date:
    return value.replace(day=1)

def add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)

def month_label(value: date) -> str:
    return value.strftime("%b")

def month_key(value: date) -> str:
    return value.strftime("%Y-%m")

def month_windows(months: int = 6, today: date | None = None) -> list[dict]:
    """Closed historical months plus the current month-to-date.

    Provider APIs differ, but AWS Cost Explorer uses an exclusive End date. The
    returned end_exclusive value is safe for APIs with exclusive end bounds.
    """
    today = today or date.today()
    current = month_start(today)
    first = add_months(current, -(months - 1))
    windows: list[dict] = []

    for offset in range(months):
        start = add_months(first, offset)
        next_start = add_months(start, 1)
        is_current = start == current
        end_exclusive = min(next_start, today + timedelta(days=1)) if is_current else next_start
        windows.append({
            "key": month_key(start),
            "label": month_label(start),
            "start": start.isoformat(),
            "endExclusive": end_exclusive.isoformat(),
            "isClosed": not is_current,
        })

    return windows

def forecast_month_windows(months: int = 6, today: date | None = None) -> list[dict]:
    today = today or date.today()
    current = month_start(today)
    return [
        {
            "key": month_key(add_months(current, offset)),
            "label": month_label(add_months(current, offset)),
            "isCurrent": offset == 0,
        }
        for offset in range(months)
    ]

def cur_month_range() -> tuple[str, str]:
    today = date.today()
    return today.replace(day=1).isoformat(), (today + timedelta(days=1)).isoformat()

def prev_month_range() -> tuple[str, str]:
    today = date.today()
    first_current = today.replace(day=1)
    first_day_prev = (first_current - timedelta(days=1)).replace(day=1)
    return first_day_prev.isoformat(), first_current.isoformat()

def service_line(
    *,
    name: str,
    count: str,
    current: float,
    previous: float,
    detail: str,
    unit: str = "USD",
    estimated: bool = False,
) -> dict:
    return {
        "name": name,
        "count": count,
        "spend": fmt_usd(current) if unit == "USD" else count,
        "spendAmount": round(current, 2),
        "previousSpendAmount": round(previous, 2),
        "trend": fmt_trend(current, previous),
        "trendPct": trend_pct(current, previous),
        "isEstimated": estimated,
        "detail": detail,
    }

def provider_payload(
    *,
    provider: str,
    headline: str,
    total: float,
    previous_total: float,
    services: list[dict],
    events: list[str],
    source_kind: str,
    source_label: str,
    billing_period: dict,
    warnings: list[str] | None = None,
    estimated: bool = False,
) -> dict:
    warnings = warnings or []
    return {
        "provider": provider,
        "headline": headline,
        "monthlySpend": fmt_usd_mo(total),
        "previousSpend": fmt_usd_mo(previous_total) if previous_total else "n/a",
        "trend": fmt_trend(total, previous_total),
        "currency": "USD",
        "costActual": {
            "amount": round(total, 2),
            "previousAmount": round(previous_total, 2),
            "trendPct": trend_pct(total, previous_total),
            "isEstimated": estimated,
        },
        "source": {
            "kind": source_kind,
            "label": source_label,
            "generatedAt": utc_now_iso(),
            "billingPeriod": billing_period,
            "warnings": warnings,
        },
        "services": services,
        "events": events + [f"Source quality: {source_kind}"] + warnings[:2],
    }


# ── AWS ───────────────────────────────────────────────────────────────────────

def scrape_aws() -> dict:
    import boto3

    ce      = boto3.client("ce")
    home_region = os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"
    ec2_home = boto3.client("ec2", region_name=home_region)
    s3_c    = boto3.client("s3", region_name=home_region)
    warnings: list[str] = []

    def cost_by_service(start: str, end: str) -> dict[str, float]:
        out: dict[str, float] = {}
        token = None
        while True:
            request = {
                "TimePeriod": {"Start": start, "End": end},
                "Granularity": "MONTHLY",
                "Metrics": ["UnblendedCost"],
                "GroupBy": [{"Type": "DIMENSION", "Key": "SERVICE"}],
            }
            if token:
                request["NextPageToken"] = token
            resp = ce.get_cost_and_usage(**request)
            for result in resp["ResultsByTime"]:
                for group in result["Groups"]:
                    svc = group["Keys"][0]
                    out[svc] = out.get(svc, 0.0) + float(group["Metrics"]["UnblendedCost"]["Amount"])
            token = resp.get("NextPageToken")
            if not token:
                break
        return out

    start_c, end_c = cur_month_range()
    start_p, end_p = prev_month_range()
    cur = cost_by_service(start_c, end_c)
    prev = cost_by_service(start_p, end_p)
    total_c = sum(cur.values())
    total_p = sum(prev.values())

    # Resource counts across regions where available. Failures are warnings so
    # one denied inventory API does not discard real Cost Explorer actuals.
    try:
        regions = [
            item["RegionName"]
            for item in ec2_home.describe_regions(AllRegions=False)["Regions"]
        ]
    except Exception as exc:
        regions = [home_region]
        warnings.append(f"AWS region discovery failed: {exc}")

    ec2_count = 0
    ecs_svc_count = 0
    ecs_cluster_count = 0
    rds_count = 0
    amp_count = 0

    for region in regions:
        try:
            ec2_c = boto3.client("ec2", region_name=region)
            paginator = ec2_c.get_paginator("describe_instances")
            for page in paginator.paginate(
                Filters=[{"Name": "instance-state-name", "Values": ["running"]}]
            ):
                ec2_count += sum(len(r["Instances"]) for r in page["Reservations"])
        except Exception as exc:
            warnings.append(f"AWS EC2 inventory failed in {region}: {exc}")

        try:
            ecs_c = boto3.client("ecs", region_name=region)
            cluster_arns: list[str] = []
            for page in ecs_c.get_paginator("list_clusters").paginate():
                cluster_arns.extend(page.get("clusterArns", []))
            ecs_cluster_count += len(cluster_arns)
            for cluster_arn in cluster_arns:
                for page in ecs_c.get_paginator("list_services").paginate(cluster=cluster_arn):
                    ecs_svc_count += len(page.get("serviceArns", []))
        except Exception as exc:
            warnings.append(f"AWS ECS inventory failed in {region}: {exc}")

        try:
            rds_c = boto3.client("rds", region_name=region)
            for page in rds_c.get_paginator("describe_db_instances").paginate():
                rds_count += len(page.get("DBInstances", []))
        except Exception as exc:
            warnings.append(f"AWS RDS inventory failed in {region}: {exc}")

        try:
            amp_c = boto3.client("amplify", region_name=region)
            request: dict = {}
            while True:
                page = amp_c.list_apps(**request)
                amp_count += len(page.get("apps", []))
                if not page.get("nextToken"):
                    break
                request["nextToken"] = page["nextToken"]
        except Exception as exc:
            warnings.append(f"AWS Amplify inventory failed in {region}: {exc}")

    s3_count  = len(s3_c.list_buckets()["Buckets"])

    def spend(keys: list[str]) -> tuple[float, float]:
        c = sum(cur.get(k, 0.0) for k in keys)
        p = sum(prev.get(k, 0.0) for k in keys)
        return c, p

    ec2_c_,  ec2_p_  = spend(["Amazon Elastic Compute Cloud - Compute"])
    ecs_c_,  ecs_p_  = spend(["Amazon Elastic Container Service"])
    amp_c_,  amp_p_  = spend(["AWS Amplify"])
    rds_c_,  rds_p_  = spend(["Amazon Relational Database Service"])
    s3_c_,   s3_p_   = spend(["Amazon Simple Storage Service", "AWS Data Transfer"])

    services = [
        service_line(
            name="EC2 instances",
            count=str(ec2_count),
            current=ec2_c_,
            previous=ec2_p_,
            detail=f"{ec2_count} running instances across {len(regions)} regions",
        ),
        service_line(
            name="ECS services",
            count=str(ecs_svc_count),
            current=ecs_c_,
            previous=ecs_p_,
            detail=f"{ecs_svc_count} services across {ecs_cluster_count} clusters",
        ),
        service_line(
            name="Amplify apps",
            count=str(amp_count),
            current=amp_c_,
            previous=amp_p_,
            detail=f"{amp_count} deployed apps",
        ),
        service_line(
            name="RDS databases",
            count=str(rds_count),
            current=rds_c_,
            previous=rds_p_,
            detail=f"{rds_count} DB instances",
        ),
        service_line(
            name="S3 and data transfer",
            count=f"{s3_count} buckets",
            current=s3_c_,
            previous=s3_p_,
            detail=f"{s3_count} buckets plus AWS Data Transfer",
        ),
    ]

    return provider_payload(
        provider="aws",
        headline=(
            f"{ec2_count} EC2, {ecs_svc_count} ECS services, "
            f"{rds_count} RDS databases, {amp_count} Amplify apps discovered."
        ),
        total=total_c,
        previous_total=total_p,
        services=services,
        events=[
            f"Total AWS spend: {fmt_usd_mo(total_c)}",
            f"Month-over-month change: {fmt_trend(total_c, total_p)}",
            f"{ec2_count} running EC2 instances, {rds_count} RDS instances",
        ],
        source_kind="actual",
        source_label="AWS Cost Explorer UnblendedCost + resource inventory",
        billing_period={"start": start_c, "endExclusive": end_c},
        warnings=warnings,
    )


# ── GCP ───────────────────────────────────────────────────────────────────────

def scrape_gcp() -> dict:
    from google.cloud import compute_v1, run_v2

    project = os.environ["GCP_PROJECT_ID"]
    warnings: list[str] = []

    # Running VM count (aggregated across all zones)
    inst_client = compute_v1.InstancesClient()
    agg = inst_client.aggregated_list(project=project)
    vm_count = sum(
        len([i for i in scoped.instances if i.status == "RUNNING"])
        for _, scoped in agg
        if hasattr(scoped, "instances") and scoped.instances
    )

    # Cloud Run service count (all regions)
    run_client = run_v2.ServicesClient()
    run_services = list(run_client.list_services(parent=f"projects/{project}/locations/-"))
    run_count = len(run_services)

    # Per-service costs via BigQuery billing export (optional)
    cur: dict[str, float] = {}
    prev: dict[str, float] = {}
    monthly_costs: dict[str, float] = {}
    bq_dataset = os.environ.get("GCP_BILLING_BQ_DATASET")

    if bq_dataset:
        from google.cloud import bigquery

        bq = bigquery.Client(project=project)
        today = date.today()
        cur_month  = today.replace(day=1).strftime("%Y-%m-%d")
        prev_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1).strftime("%Y-%m-%d")

        query = f"""
            SELECT
                service.description AS svc,
                SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS total,
                FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(usage_start_time), MONTH)) AS mo
            FROM `{bq_dataset}`
            WHERE DATE(usage_start_time) >= DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 5 MONTH)
            GROUP BY svc, mo
        """
        for row in bq.query(query).result():
            month_total = monthly_costs.get(row.mo, 0.0) + float(row.total)
            monthly_costs[row.mo] = month_total
            bucket = cur if row.mo == cur_month else (prev if row.mo == prev_month else None)
            if bucket is not None:
                bucket[row.svc] = bucket.get(row.svc, 0.0) + float(row.total)
    else:
        warnings.append("GCP actual costs unavailable: set GCP_BILLING_BQ_DATASET to a billing export table.")

    total_c = sum(cur.values())
    total_p = sum(prev.values())

    def spend(keys: list[str]) -> tuple[float, float]:
        return (
            sum(cur.get(k, 0.0) for k in keys),
            sum(prev.get(k, 0.0) for k in keys),
        )

    compute_c, compute_p = spend(["Compute Engine"])
    run_c,     run_p     = spend(["Cloud Run"])
    vertex_c,  vertex_p  = spend(["Vertex AI"])
    apigw_c,   apigw_p   = spend(["API Gateway", "Cloud Endpoints"])
    bq_c,      bq_p      = spend(["BigQuery"])

    def svc_spend_str(c: float) -> str:
        return fmt_usd(c) if c else "—"

    services = [
        service_line(
            name="Compute Engine VPS",
            count=str(vm_count),
            current=compute_c,
            previous=compute_p,
            detail=f"{vm_count} running VMs",
            estimated=not bool(bq_dataset),
        ),
        service_line(
            name="Cloud Run services",
            count=str(run_count),
            current=run_c,
            previous=run_p,
            detail=f"{run_count} deployed services",
            estimated=not bool(bq_dataset),
        ),
        service_line(
            name="Vertex AI jobs",
            count="—",
            current=vertex_c,
            previous=vertex_p,
            detail="Batch scoring and embeddings",
            estimated=not bool(bq_dataset),
        ),
        service_line(
            name="API Gateway",
            count="—",
            current=apigw_c,
            previous=apigw_p,
            detail="Public and partner APIs",
            estimated=not bool(bq_dataset),
        ),
        service_line(
            name="BigQuery",
            count="—",
            current=bq_c,
            previous=bq_p,
            detail="Data warehouse",
            estimated=not bool(bq_dataset),
        ),
    ]

    bq_note = "" if bq_dataset else " (set GCP_BILLING_BQ_DATASET for cost breakdown)"

    payload = provider_payload(
        provider="gcp",
        headline=f"{vm_count} Compute Engine VMs and {run_count} Cloud Run services discovered.",
        total=total_c,
        previous_total=total_p,
        services=services,
        events=[
            f"Total GCP spend: {fmt_usd_mo(total_c)}" if total_c else f"Cost data requires BQ export{bq_note}",
            f"Month-over-month change: {fmt_trend(total_c, total_p)}",
            f"{vm_count} running VMs, {run_count} Cloud Run services",
        ],
        source_kind="actual" if bq_dataset else "missing_actuals",
        source_label="Google Cloud Billing BigQuery export",
        billing_period={"start": start_c, "endExclusive": end_c},
        warnings=warnings,
        estimated=not bool(bq_dataset),
    )
    if not total_c:
        payload["monthlySpend"] = f"See GCP console{bq_note}"
    if monthly_costs:
        payload["monthlyCosts"] = [
            {"month": key, "amount": round(value, 2), "isEstimated": False}
            for key, value in sorted(monthly_costs.items())
        ]
    return payload


# ── Azure ─────────────────────────────────────────────────────────────────────

def scrape_azure() -> dict:
    from azure.identity import ClientSecretCredential
    from azure.mgmt.costmanagement import CostManagementClient
    from azure.mgmt.costmanagement.models import (
        QueryAggregation,
        QueryDataset,
        QueryDefinition,
        QueryGrouping,
        QueryTimePeriod,
    )
    from azure.mgmt.resource import ResourceManagementClient

    cred = ClientSecretCredential(
        tenant_id=os.environ["AZURE_TENANT_ID"],
        client_id=os.environ["AZURE_CLIENT_ID"],
        client_secret=os.environ["AZURE_CLIENT_SECRET"],
    )
    sub_id = os.environ["AZURE_SUBSCRIPTION_ID"]
    scope  = f"/subscriptions/{sub_id}"

    cost_client     = CostManagementClient(cred)
    resource_client = ResourceManagementClient(cred, sub_id)
    warnings: list[str] = []

    def query_costs(start: str, end: str) -> dict[str, float]:
        result = cost_client.query.usage(
            scope,
            QueryDefinition(
                type="ActualCost",
                timeframe="Custom",
                time_period=QueryTimePeriod(
                    from_property=f"{start}T00:00:00Z",
                    to=f"{end}T23:59:59Z",
                ),
                dataset=QueryDataset(
                    granularity="None",
                    aggregation={"totalCost": QueryAggregation(name="Cost", function="Sum")},
                    grouping=[QueryGrouping(type="Dimension", name="ServiceName")],
                ),
            ),
        )
        cols  = [c.name for c in result.columns]
        cost_column = "Cost" if "Cost" in cols else ("PreTaxCost" if "PreTaxCost" in cols else cols[0])
        c_idx = cols.index(cost_column)
        s_idx = cols.index("ServiceName")
        out: dict[str, float] = {}
        for row in result.rows:
            svc = row[s_idx]
            out[svc] = out.get(svc, 0.0) + float(row[c_idx])
        return out

    start_c, end_c = cur_month_range()
    start_p, end_p = prev_month_range()
    try:
        cur  = query_costs(start_c, (datetime.fromisoformat(end_c).date() - timedelta(days=1)).isoformat())
        prev = query_costs(start_p, (datetime.fromisoformat(end_p).date() - timedelta(days=1)).isoformat())
        cost_source_kind = "actual"
    except Exception as exc:
        cur = {}
        prev = {}
        cost_source_kind = "missing_actuals"
        warnings.append(f"Azure Cost Management actuals unavailable: {exc}")
    total_c = sum(cur.values())
    total_p = sum(prev.values())

    # Resource inventory
    all_resources = list(resource_client.resources.list())
    app_count     = sum(1 for r in all_resources if r.type == "Microsoft.Web/sites")
    vm_count      = sum(1 for r in all_resources if r.type == "Microsoft.Compute/virtualMachines")
    storage_count = sum(1 for r in all_resources if r.type == "Microsoft.Storage/storageAccounts")

    def spend(keys: list[str]) -> tuple[float, float]:
        return (
            sum(cur.get(k, 0.0) for k in keys),
            sum(prev.get(k, 0.0) for k in keys),
        )

    app_c,     app_p     = spend(["Azure App Service"])
    vm_c,      vm_p      = spend(["Virtual Machines"])
    openai_c,  openai_p  = spend(["Cognitive Services", "Azure OpenAI Service"])
    storage_c, storage_p = spend(["Storage"])

    services = [
        service_line(
            name="App Service plans",
            count=str(app_count),
            current=app_c,
            previous=app_p,
            detail=f"{app_count} web apps",
            estimated=cost_source_kind != "actual",
        ),
        service_line(
            name="Virtual machines",
            count=str(vm_count),
            current=vm_c,
            previous=vm_p,
            detail=f"{vm_count} VMs",
            estimated=cost_source_kind != "actual",
        ),
        service_line(
            name="Azure OpenAI",
            count="—",
            current=openai_c,
            previous=openai_p,
            detail="Cognitive / OpenAI workloads",
            estimated=cost_source_kind != "actual",
        ),
        service_line(
            name="Storage accounts",
            count=str(storage_count),
            current=storage_c,
            previous=storage_p,
            detail=f"{storage_count} storage accounts",
            estimated=cost_source_kind != "actual",
        ),
    ]

    return provider_payload(
        provider="azure",
        headline=(
            f"{vm_count} VMs, {app_count} App Service apps, "
            f"{storage_count} storage accounts discovered."
        ),
        total=total_c,
        previous_total=total_p,
        services=services,
        events=[
            f"Total Azure spend: {fmt_usd_mo(total_c)}" if total_c else "Azure spend requires Cost Management access.",
            f"Month-over-month change: {fmt_trend(total_c, total_p)}",
            f"{vm_count} VMs, {app_count} App Service apps",
        ],
        source_kind=cost_source_kind,
        source_label="Azure Cost Management ActualCost",
        billing_period={"start": start_c, "endExclusive": end_c},
        warnings=warnings,
        estimated=cost_source_kind != "actual",
    )


# ── Cloudflare ────────────────────────────────────────────────────────────────

def scrape_cloudflare() -> dict:
    import requests

    token      = os.environ["CLOUDFLARE_API_TOKEN"]
    account_id = os.environ["CLOUDFLARE_ACCOUNT_ID"]
    hdrs = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    base = "https://api.cloudflare.com/client/v4"
    warnings: list[str] = []

    # Zones
    zones = []
    page = 1
    while True:
        zones_resp = requests.get(
            f"{base}/zones",
            headers=hdrs,
            params={"account.id": account_id, "per_page": 50, "page": page},
            timeout=15,
        ).json()
        zones.extend(zones_resp.get("result", []))
        info = zones_resp.get("result_info") or {}
        if page >= int(info.get("total_pages") or 1):
            break
        page += 1

    # Billing subscriptions (plan-level cost)
    subs_resp = requests.get(
        f"{base}/accounts/{account_id}/subscriptions", headers=hdrs, timeout=15
    ).json()
    plan_cost = sum(float(s.get("price", 0)) for s in subs_resp.get("result", []))

    # GraphQL analytics
    gql = "https://api.cloudflare.com/client/v4/graphql"

    def analytics(zone: str, since: str, until: str) -> dict:
        # Cloudflare GraphQL expects dates as YYYY-MM-DD for date filters
        query = """
        query ($zone: String!, $since: Date!, $until: Date!) {
          viewer {
            zones(filter: { zoneTag: $zone }) {
              httpRequests1dGroups(
                limit: 31
                orderBy: [date_ASC]
                filter: { date_geq: $since, date_leq: $until }
              ) {
                sum { requests bytes cachedRequests cachedBytes }
              }
            }
          }
        }
        """
        resp = requests.post(
            gql,
            headers=hdrs,
            json={"query": query, "variables": {"zone": zone, "since": since, "until": until}},
            timeout=15,
        )
        return resp.json()

    def workers_analytics(account: str, since: str, until: str) -> dict:
        # Workers analytics are account-scoped
        query = """
        query ($account: String!, $since: DateTime!, $until: DateTime!) {
          viewer {
            accounts(filter: { accountTag: $account }) {
              workersInvocationsAdaptive(
                limit: 31
                filter: { datetime_geq: $since, datetime_leq: $until }
              ) {
                sum { requests errors }
              }
            }
          }
        }
        """
        resp = requests.post(
            gql,
            headers=hdrs,
            json={
                "query": query,
                "variables": {
                    "account": account,
                    "since": f"{since}T00:00:00Z",
                    "until": f"{until}T23:59:59Z",
                },
            },
            timeout=15,
        )
        return resp.json()

    start_c, end_c = cur_month_range()
    start_p, end_p = prev_month_range()

    def extract_http(data: dict) -> tuple[int, int, int]:
        """Returns (total_bytes, total_requests, cached_requests)."""
        try:
            groups = data["data"]["viewer"]["zones"][0]["httpRequests1dGroups"]
            total_bytes   = sum(g["sum"]["bytes"]          for g in groups)
            total_req     = sum(g["sum"]["requests"]        for g in groups)
            cached_req    = sum(g["sum"]["cachedRequests"]  for g in groups)
            return total_bytes, total_req, cached_req
        except (KeyError, IndexError, TypeError):
            return 0, 0, 0

    def extract_workers(data: dict) -> int:
        try:
            groups = data["data"]["viewer"]["accounts"][0]["workersInvocationsAdaptive"]
            return sum(g["sum"]["requests"] for g in groups)
        except (KeyError, IndexError, TypeError):
            return 0

    bytes_c, req_c, cached_c = (0, 0, 0)
    bytes_p, req_p, cached_p = (0, 0, 0)
    workers_c = workers_p = 0

    for zone in zones:
        zone_id = zone["id"]
        http_c = extract_http(analytics(zone_id, start_c, end_c))
        http_p = extract_http(analytics(zone_id, start_p, end_p))
        bytes_c += http_c[0]
        req_c += http_c[1]
        cached_c += http_c[2]
        bytes_p += http_p[0]
        req_p += http_p[1]
        cached_p += http_p[2]

    workers_c = extract_workers(workers_analytics(account_id, start_c, end_c))
    workers_p = extract_workers(workers_analytics(account_id, start_p, end_p))

    tb_c = bytes_c / 1e12
    tb_p = bytes_p / 1e12
    hit_rate = (cached_c / req_c * 100) if req_c else 0.0

    warnings.append("Cloudflare spend is plan/subscription cost only; usage-based add-ons are not fully allocated by service.")
    services = [
        service_line(
            name="CDN bandwidth",
            count=f"{tb_c:.1f} TB",
            current=0,
            previous=0,
            detail=f"{len(zones)} zone(s), {hit_rate:.0f}% cache hit rate",
            estimated=True,
        ),
        service_line(
            name="Workers",
            count=f"{workers_c / 1e6:.0f}M req",
            current=0,
            previous=0,
            detail="Edge Worker invocations",
            estimated=True,
        ),
        service_line(
            name="Total HTTP requests",
            count=f"{req_c / 1e6:.0f}M",
            current=0,
            previous=0,
            detail=f"Cache hit rate: {hit_rate:.0f}%",
            estimated=True,
        ),
    ]
    for service in services:
        service["spend"] = "—"

    return provider_payload(
        provider="cloudflare",
        headline=(
            f"{len(zones)} zone(s). {tb_c:.1f} TB bandwidth. "
            f"{hit_rate:.0f}% cache hit rate."
        ),
        total=plan_cost,
        previous_total=0,
        services=services,
        events=[
            f"Bandwidth: {tb_c:.1f} TB (prev {tb_p:.1f} TB)",
            f"Workers: {workers_c / 1e6:.1f}M invocations",
            f"Cache hit rate: {hit_rate:.0f}%",
        ],
        source_kind="partial_actual" if plan_cost else "missing_actuals",
        source_label="Cloudflare account subscriptions + GraphQL analytics",
        billing_period={"start": start_c, "endExclusive": end_c},
        warnings=warnings,
        estimated=not bool(plan_cost),
    )


# ── pricing catalogue (public web scrape, no auth) ────────────────────────────

UA_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

CLOUDFLARE_PRICING_URLS = {
    "workers": "https://developers.cloudflare.com/workers/platform/pricing/",
    "r2":      "https://developers.cloudflare.com/r2/pricing/",
    "d1":      "https://developers.cloudflare.com/d1/platform/pricing/",
    "kv":      "https://developers.cloudflare.com/kv/platform/pricing/",
}

GCP_PRICING_URLS = {
    "compute":   "https://cloud.google.com/compute/all-pricing",
    "storage":   "https://cloud.google.com/storage/pricing",
    "run":       "https://cloud.google.com/run/pricing",
    "functions": "https://cloud.google.com/functions/pricing",
}

GCP_CLOUD_BILLING_API = "https://cloudbilling.googleapis.com/v1"


def _fetch(url: str, timeout: int = 15) -> str | None:
    import requests
    try:
        r = requests.get(url, headers=UA_HEADERS, timeout=timeout)
        r.raise_for_status()
        return r.text
    except Exception as exc:
        print(f"  [warn] fetch {url}: {exc}", file=sys.stderr)
        return None


def _parse_pricing_tables(html: str, source_url: str) -> list[dict]:
    """Generic table parser. Extracts rows with $ prices from any <table>."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    items: list[dict] = []

    for table in soup.find_all("table"):
        headers = [th.get_text(strip=True) for th in table.find_all("th")]
        for tr in table.find_all("tr"):
            cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
            if not cells:
                continue
            joined = " | ".join(cells)
            if "$" not in joined and "free" not in joined.lower():
                continue
            row = {"raw": cells}
            if headers and len(headers) == len(cells):
                row = dict(zip(headers, cells))
            items.append(row)
    return items


def _regex_prices(html: str) -> list[str]:
    """Fallback: grep $-prefixed prices from raw HTML when tables are JS-rendered."""
    prices = re.findall(r"\$\s?\d+(?:\.\d+)?(?:\s?(?:per|/)\s?[A-Za-z]+)?", html)
    return list(dict.fromkeys(prices))[:40]


def scrape_cloudflare_pricing() -> dict:
    """Pricing catalogue per service from developers.cloudflare.com."""
    result: dict[str, dict] = {}

    def fetch_one(key: str, url: str) -> tuple[str, dict]:
        html = _fetch(url)
        if not html:
            return key, {"url": url, "items": [], "error": "fetch failed"}
        items = _parse_pricing_tables(html, url)
        if not items:
            return key, {"url": url, "items": [], "regex_prices": _regex_prices(html)}
        return key, {"url": url, "items": items}

    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = [ex.submit(fetch_one, k, u) for k, u in CLOUDFLARE_PRICING_URLS.items()]
        for fut in as_completed(futures):
            try:
                k, payload = fut.result()
                result[k] = payload
                print(f"  cloudflare/{k}: {len(payload.get('items', []))} row(s)", file=sys.stderr)
            except Exception as exc:
                print(f"  [warn] cloudflare worker: {exc}", file=sys.stderr)

    return result


# Curated SKU prefixes worth surfacing from Google's pricelist.json.
# pricelist.json keys look like CP-COMPUTEENGINE-VMIMAGE-N1-STANDARD-1.
GCP_SKU_PATTERNS = [
    ("compute_engine_standard", re.compile(r"^CP-COMPUTEENGINE-VMIMAGE-(E2|N1|N2|N2D)-STANDARD-(1|2|4|8|16)$")),
    ("compute_engine_highmem",  re.compile(r"^CP-COMPUTEENGINE-VMIMAGE-(N1|N2)-HIGHMEM-(2|4|8|16)$")),
    ("compute_engine_highcpu",  re.compile(r"^CP-COMPUTEENGINE-VMIMAGE-(N1|N2)-HIGHCPU-(2|4|8|16)$")),
    ("cloud_storage",           re.compile(r"^CP-(BIGSTORE|COLDLINE|NEARLINE|ARCHIVE)-STORAGE.*$")),
    ("cloud_run",               re.compile(r"^CP-CLOUDFUNCTIONS-INVOCATIONS$|^CP-CLOUDRUN-.*$")),
    ("cloud_functions",         re.compile(r"^CP-CLOUDFUNCTIONS-.*$")),
    ("network_egress",          re.compile(r"^CP-COMPUTEENGINE-INTERNET-EGRESS-.*$|^CP-NETWORK-EGRESS-.*$")),
]


def _gcp_from_catalog_api() -> dict | None:
    """Primary GCP path: official Cloud Billing Catalog API."""
    import requests
    params = {"pageSize": "5000"}
    api_key = resolve_gcp_api_key()
    if api_key:
        params["key"] = api_key

    try:
        r = requests.get(f"{GCP_CLOUD_BILLING_API}/services", headers=UA_HEADERS, params=params, timeout=20)
        r.raise_for_status()
        services = r.json().get("services", [])
    except Exception as exc:
        print(f"  [warn] cloudbilling services: {exc}", file=sys.stderr)
        return None

    wanted = {
        "Compute Engine": "compute",
        "Cloud Storage": "storage",
        "Cloud Run": "run",
        "Cloud Functions": "functions",
    }
    service_names = {
        wanted[item["displayName"]]: item["name"]
        for item in services
        if item.get("displayName") in wanted
    }
    if not service_names:
        return None

    grouped: dict[str, list[dict]] = {}

    for group_name, service_name in service_names.items():
        rows: list[dict] = []
        page_token = None
        while True:
            request_params = dict(params)
            if page_token:
                request_params["pageToken"] = page_token
            try:
                r = requests.get(
                    f"{GCP_CLOUD_BILLING_API}/{service_name}/skus",
                    headers=UA_HEADERS,
                    params=request_params,
                    timeout=30,
                )
                r.raise_for_status()
                data = r.json()
            except Exception as exc:
                print(f"  [warn] cloudbilling skus {service_name}: {exc}", file=sys.stderr)
                break

            for sku in data.get("skus", []):
                category = sku.get("category") or {}
                pricing = (sku.get("pricingInfo") or [{}])[0]
                expression = pricing.get("pricingExpression") or {}
                tiered = expression.get("tieredRates") or []
                unit_price = ((tiered[0] if tiered else {}).get("unitPrice") or {})
                units = float(unit_price.get("units") or 0)
                nanos = float(unit_price.get("nanos") or 0) / 1_000_000_000
                price = units + nanos
                if price <= 0:
                    continue
                rows.append({
                    "skuId": sku.get("skuId"),
                    "description": sku.get("description"),
                    "serviceRegions": sku.get("serviceRegions") or [],
                    "resourceFamily": category.get("resourceFamily"),
                    "resourceGroup": category.get("resourceGroup"),
                    "usageType": category.get("usageType"),
                    "unit": expression.get("usageUnitDescription") or expression.get("usageUnit"),
                    "priceUsd": round(price, 10),
                })

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        grouped[group_name] = rows[:150]

    grouped["_source"] = f"{GCP_CLOUD_BILLING_API}/services/*/skus"
    grouped["_service_count_total"] = len(services)
    return grouped


def _gcp_from_legacy_pricelist() -> dict | None:
    """Legacy fallback for environments where the official Catalog API is unavailable."""
    import requests
    legacy_url = "https://cloudpricingcalculator.appspot.com/static/data/pricelist.json"
    try:
        r = requests.get(legacy_url, headers=UA_HEADERS, timeout=20)
        r.raise_for_status()
        data = r.json()
    except Exception as exc:
        print(f"  [warn] legacy pricelist.json: {exc}", file=sys.stderr)
        return None

    skus = data.get("gcp_price_list") or {}
    grouped: dict[str, list[dict]] = {name: [] for name, _ in GCP_SKU_PATTERNS}

    for sku, payload in skus.items():
        if not isinstance(payload, dict):
            continue
        # Pricelist regions are keys like "us", "us-central1", plus "core" / "memory" / etc.
        # Prefer "us" if present, else first numeric value found.
        price = None
        for region_key in ("us", "us-central1", "us-east1"):
            if region_key in payload and isinstance(payload[region_key], (int, float)):
                price = payload[region_key]
                break
        if price is None:
            for v in payload.values():
                if isinstance(v, (int, float)):
                    price = v
                    break
        if price is None:
            continue

        for group_name, pattern in GCP_SKU_PATTERNS:
            if pattern.match(sku):
                grouped[group_name].append({
                    "sku": sku,
                    "price_usd": price,
                    "unit": "per hour" if "COMPUTEENGINE-VMIMAGE" in sku else "see SKU docs",
                })
                break

    # Drop empty groups and sort by price for readability.
    cleaned = {k: sorted(v, key=lambda r: r["price_usd"])[:25] for k, v in grouped.items() if v}
    cleaned["_source"] = legacy_url
    cleaned["_sku_count_total"] = len(skus)
    return cleaned


def _gcp_from_html() -> dict:
    """Fallback GCP path: regex $-prices from HTML pricing pages."""
    result: dict[str, dict] = {}

    def fetch_one(key: str, url: str) -> tuple[str, dict]:
        html = _fetch(url, timeout=25)
        if not html:
            return key, {"url": url, "items": [], "error": "fetch failed"}
        items = _parse_pricing_tables(html, url)
        if not items:
            return key, {"url": url, "items": [], "regex_prices": _regex_prices(html)}
        return key, {"url": url, "items": items}

    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = [ex.submit(fetch_one, k, u) for k, u in GCP_PRICING_URLS.items()]
        for fut in as_completed(futures):
            try:
                k, payload = fut.result()
                result[k] = payload
                tag = "items" if payload.get("items") else "regex_prices"
                print(f"  gcp/{k}: {len(payload.get(tag, []))} {tag}", file=sys.stderr)
            except Exception as exc:
                print(f"  [warn] gcp worker: {exc}", file=sys.stderr)

    return result


def scrape_gcp_pricing() -> dict:
    """GCP pricing: official Catalog API first, fall back with provenance."""
    print("  trying Cloud Billing Catalog API ...", file=sys.stderr)
    from_catalog = _gcp_from_catalog_api()
    if from_catalog and any(v for k, v in from_catalog.items() if not k.startswith("_")):
        print(f"  Cloud Billing Catalog API OK ({from_catalog.get('_service_count_total', 0)} services total)", file=sys.stderr)
        return {"source": "cloud_billing_catalog_api", **from_catalog}

    print("  Catalog API unavailable, trying legacy pricelist.json ...", file=sys.stderr)
    from_json = _gcp_from_legacy_pricelist()
    if from_json and any(v for k, v in from_json.items() if not k.startswith("_")):
        print(f"  legacy pricelist.json OK ({from_json.get('_sku_count_total', 0)} SKUs total)", file=sys.stderr)
        return {"source": "legacy_pricelist_json", **from_json}

    print("  legacy pricelist empty, falling back to HTML ...", file=sys.stderr)
    html = _gcp_from_html()
    return {"source": "html_scrape_partial", **html}


DATA_DIR = os.path.join(os.path.dirname(__file__), "src", "data")
ACCOUNT_DATA_DIR = os.path.join(DATA_DIR, "account-state")
PUBLIC_PRICING_DIR = os.path.join(DATA_DIR, "cloud-pricing")
PRICING_OUT_FILE = os.path.join(PUBLIC_PRICING_DIR, "legacy-catalogue.json")
PUBLIC_PRICING_INPUT_FILE = os.path.join(PUBLIC_PRICING_DIR, "inputs.json")
PUBLIC_PRICING_CATALOGUE_FILE = os.path.join(PUBLIC_PRICING_DIR, "catalogue.json")
PUBLIC_PRICING_ESTIMATES_FILE = os.path.join(PUBLIC_PRICING_DIR, "estimate.json")

AWS_PRICE_LIST_BASE = "https://pricing.us-east-1.amazonaws.com"
AWS_OFFER_INDEX_URL = f"{AWS_PRICE_LIST_BASE}/offers/v1.0/aws/index.json"
GCP_PUBLIC_BILLING_API = "https://cloudbilling.googleapis.com/v1"
AZURE_RETAIL_PRICES_API = "https://prices.azure.com/api/retail/prices"

DEFAULT_PUBLIC_PRICING_INPUTS = {
    "schemaVersion": 1,
    "currency": "USD",
    "applyFreeTier": False,
    "regions": {
        "aws": "eu-central-1",
        "gcp": "europe-west3",
        "azure": "germanywestcentral",
        "cloudflare": "global",
    },
    "providers": {
        "aws": {
            "ec2InstanceTypes": ["t3.micro", "t3.small", "t3.medium"],
            "ec2DefaultInstanceType": "t3.medium",
        },
        "gcp": {
            "computeMachineTypes": ["e2-micro", "e2-small", "e2-medium"],
            "computeDefaultMachineType": "e2-medium",
        },
        "azure": {
            "vmSkus": ["Standard_B1s", "Standard_B2s", "Standard_D2s_v5"],
            "vmDefaultSku": "Standard_D2s_v5",
            "aksNodeSku": "Standard_D2s_v5",
        },
        "cloudflare": {
            "workersPlan": "paid",
        },
    },
    "usage": {
        "compute": {
            "instanceCount": 1,
            "hoursPerMonth": 730,
        },
        "ecsFargate": {
            "taskCount": 1,
            "vcpu": 0.5,
            "memoryGb": 1,
            "hoursPerMonth": 730,
        },
        "aks": {
            "nodeCount": 1,
            "hoursPerMonth": 730,
        },
        "cloudRun": {
            "requestsPerMonth": 1_000_000,
            "vcpuSecondsPerMonth": 180_000,
            "memoryGbSecondsPerMonth": 360_000,
        },
        "workers": {
            "requestsPerMonth": 10_000_000,
            "cpuMillisecondsPerMonth": 30_000_000,
        },
        "logs": {
            "ingestGbPerMonth": 100,
            "retentionGbMonth": 100,
            "logpushRequestsPerMonth": 10_000_000,
        },
        "storage": {
            "storageGbMonth": 100,
            "classAOperationsPerMonth": 10_000,
            "classBOperationsPerMonth": 100_000,
        },
        "loadBalancer": {
            "count": 1,
            "hoursPerMonth": 730,
            "lcuHoursPerMonth": 730,
            "dataGbPerMonth": 100,
        },
    },
}

GCP_MACHINE_SHAPES = {
    "e2-micro": {"vcpu": 0.25, "memoryGb": 1},
    "e2-small": {"vcpu": 0.5, "memoryGb": 2},
    "e2-medium": {"vcpu": 1, "memoryGb": 4},
}


def _deep_merge(base: dict, override: dict) -> dict:
    merged = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_public_pricing_inputs(path: str = PUBLIC_PRICING_INPUT_FILE) -> dict:
    if not os.path.exists(path):
        return deepcopy(DEFAULT_PUBLIC_PRICING_INPUTS)

    with open(path) as fh:
        user_inputs = json.load(fh)
    return _deep_merge(DEFAULT_PUBLIC_PRICING_INPUTS, user_inputs)


def write_default_public_pricing_inputs(path: str = PUBLIC_PRICING_INPUT_FILE) -> None:
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(DEFAULT_PUBLIC_PRICING_INPUTS, fh, indent=2)
        fh.write("\n")


def _fetch_json_url(url: str, timeout: int = 40) -> dict | None:
    try:
        request = Request(url, headers=UA_HEADERS)
        with urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except Exception as exc:
        print(f"  [warn] fetch JSON {url}: {exc}", file=sys.stderr)
        return None


def _to_float(value: object, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _money_from_text(text: str) -> float | None:
    match = re.search(r"\$\s*([0-9]+(?:\.[0-9]+)?)", text)
    return float(match.group(1)) if match else None


def _normalized_text(value: object) -> str:
    if isinstance(value, dict):
        parts = [str(v) for v in value.values()]
    elif isinstance(value, list):
        parts = [str(v) for v in value]
    else:
        parts = [str(value)]
    return " ".join(parts).lower()


def _catalog_item(
    *,
    provider: str,
    service: str,
    sku: str,
    description: str,
    region: str,
    unit: str,
    unit_price_usd: float | None,
    source_url: str,
    source_type: str,
    currency: str = "USD",
    status: str | None = None,
    metadata: dict | None = None,
) -> dict:
    price = None if unit_price_usd is None else round(float(unit_price_usd), 12)
    return {
        "provider": provider,
        "service": service,
        "sku": sku,
        "description": description,
        "region": region,
        "unit": unit,
        "unitPriceUsd": price,
        "currency": currency,
        "status": status or ("priced" if price is not None else "unpriced"),
        "sourceUrl": source_url,
        "sourceType": source_type,
        "metadata": metadata or {},
    }


def _first_catalog_item(items: list[dict], provider: str, service: str, sku: str) -> dict | None:
    for item in items:
        if item["provider"] == provider and item["service"] == service and item["sku"] == sku:
            return item
    return None


def _first_aws_price_dimension(offer: dict, sku: str) -> dict | None:
    terms = ((offer.get("terms") or {}).get("OnDemand") or {}).get(sku) or {}
    dimensions: list[dict] = []
    for term in terms.values():
        for dimension in (term.get("priceDimensions") or {}).values():
            amount = _to_float((dimension.get("pricePerUnit") or {}).get("USD"), -1)
            if amount >= 0:
                dimensions.append({
                    "price": amount,
                    "unit": dimension.get("unit") or "unit",
                    "description": dimension.get("description") or "",
                    "beginRange": dimension.get("beginRange"),
                    "endRange": dimension.get("endRange"),
                })
    positive = [
        dimension
        for dimension in dimensions
        if dimension["price"] > 0 and "reservation" not in dimension["description"].lower()
    ]
    return (positive or dimensions or [None])[0]


def _aws_offer_url(offer_code: str, region: str) -> str:
    return f"{AWS_PRICE_LIST_BASE}/offers/v1.0/aws/{offer_code}/current/{region}/index.json"


def _aws_offer_codes() -> dict[str, str]:
    index = _fetch_json_url(AWS_OFFER_INDEX_URL, timeout=20) or {}
    offers = index.get("offers") or {}
    codes: dict[str, str] = {}
    for code, payload in offers.items():
        name = (payload.get("offerCode") or code).lower()
        title = (payload.get("currentVersionUrl") or "").lower()
        codes[name] = payload.get("offerCode") or code
        if "amazoncloudwatch" in name or "amazoncloudwatch" in title:
            codes["amazoncloudwatch"] = payload.get("offerCode") or code
        if "awselb" in name or "elasticloadbalancing" in name or "elasticloadbalancing" in title:
            codes["awselb"] = payload.get("offerCode") or code
    return codes


def _aws_priced_products(offer: dict, predicate) -> list[tuple[dict, dict]]:
    matches: list[tuple[dict, dict]] = []
    for sku, product in (offer.get("products") or {}).items():
        dimension = _first_aws_price_dimension(offer, sku)
        if not dimension:
            continue
        if predicate(product, dimension):
            matches.append((product, dimension))
    return matches


def build_aws_public_catalogue(config: dict) -> tuple[list[dict], list[str]]:
    region = config["regions"]["aws"]
    wanted_types = config["providers"]["aws"]["ec2InstanceTypes"]
    offer_codes = _aws_offer_codes()
    fallbacks = {
        "ec2": "AmazonEC2",
        "ecs": "AmazonECS",
        "cloudwatch": "AmazonCloudWatch",
        "s3": "AmazonS3",
        "elb": "AWSELB",
    }
    offers: dict[str, tuple[str, dict]] = {}
    warnings: list[str] = []

    for key, fallback in fallbacks.items():
        code = offer_codes.get(fallback.lower(), fallback)
        url = _aws_offer_url(code, region)
        payload = _fetch_json_url(url)
        if not payload:
            warnings.append(f"AWS {fallback} price file unavailable for {region}.")
            continue
        offers[key] = (url, payload)

    items: list[dict] = []

    if "ec2" in offers:
        url, offer = offers["ec2"]
        chosen: dict[str, tuple[dict, dict]] = {}
        for product, dimension in _aws_priced_products(
            offer,
            lambda product, dimension: (
                product.get("productFamily") == "Compute Instance"
                and (product.get("attributes") or {}).get("instanceType") in wanted_types
                and (product.get("attributes") or {}).get("operatingSystem") == "Linux"
                and (product.get("attributes") or {}).get("tenancy") == "Shared"
                and (product.get("attributes") or {}).get("preInstalledSw") in {"NA", "None"}
                and (product.get("attributes") or {}).get("capacitystatus") == "Used"
                and dimension.get("unit") in {"Hrs", "Hours"}
                and dimension.get("price", 0) > 0
                and "reservation" not in _normalized_text([product, dimension])
            ),
        ):
            instance_type = (product.get("attributes") or {}).get("instanceType")
            if instance_type not in chosen or dimension["price"] < chosen[instance_type][1]["price"]:
                chosen[instance_type] = (product, dimension)

        for instance_type in wanted_types:
            row = chosen.get(instance_type)
            if not row:
                warnings.append(f"AWS EC2 {instance_type} Linux on-demand price not found in {region}.")
                continue
            product, dimension = row
            attrs = product.get("attributes") or {}
            items.append(_catalog_item(
                provider="aws",
                service="EC2",
                sku=instance_type,
                description=dimension["description"] or f"{instance_type} Linux on-demand",
                region=region,
                unit="hour",
                unit_price_usd=dimension["price"],
                source_url=url,
                source_type="aws_price_list_bulk_api",
                metadata={"awsSku": product.get("sku"), "operation": attrs.get("operation")},
            ))

    if "ecs" in offers:
        url, offer = offers["ecs"]
        fargate_rows = _aws_priced_products(
            offer,
            lambda product, dimension: (
                "fargate" in _normalized_text(product)
                and "hour" in (dimension.get("unit") or "").lower()
            ),
        )
        for wanted, sku, unit in [
            (("vcpu", "cpu"), "fargate-vcpu-hour", "vcpu-hour"),
            (("gb", "memory"), "fargate-memory-gb-hour", "gb-hour"),
        ]:
            row = next((
                (product, dimension)
                for product, dimension in fargate_rows
                if any(token in _normalized_text([product, dimension]) for token in wanted)
            ), None)
            if not row:
                warnings.append(f"AWS ECS Fargate {sku} price not found in {region}.")
                continue
            product, dimension = row
            items.append(_catalog_item(
                provider="aws",
                service="ECS Fargate",
                sku=sku,
                description=dimension["description"] or sku,
                region=region,
                unit=unit,
                unit_price_usd=dimension["price"],
                source_url=url,
                source_type="aws_price_list_bulk_api",
                metadata={"awsSku": product.get("sku")},
            ))

    if "cloudwatch" in offers:
        url, offer = offers["cloudwatch"]
        candidates = _aws_priced_products(
            offer,
            lambda product, dimension: "log" in _normalized_text([product, dimension]),
        )
        rules = [
            ("logs-ingest-gb", "GB", ("ingest", "data processing", "dataprocessing")),
            ("logs-storage-gb-month", "GB-month", ("storage", "archive", "timedstorage")),
        ]
        for sku, unit, tokens in rules:
            row = next((
                (product, dimension)
                for product, dimension in candidates
                if any(token in _normalized_text([product, dimension]) for token in tokens)
            ), None)
            if not row:
                warnings.append(f"AWS CloudWatch Logs {sku} price not found in {region}.")
                continue
            product, dimension = row
            items.append(_catalog_item(
                provider="aws",
                service="CloudWatch Logs",
                sku=sku,
                description=dimension["description"] or sku,
                region=region,
                unit=unit,
                unit_price_usd=dimension["price"],
                source_url=url,
                source_type="aws_price_list_bulk_api",
                metadata={"awsSku": product.get("sku")},
            ))

    if "s3" in offers:
        url, offer = offers["s3"]
        candidates = _aws_priced_products(
            offer,
            lambda product, dimension: "s3" in _normalized_text([product, dimension]),
        )
        rules = [
            (
                "standard-storage-gb-month",
                "GB-month",
                lambda product, dimension: (
                    dimension.get("unit") in {"GB-Mo", "GB-month"}
                    and "standard" in _normalized_text([product, dimension])
                    and not any(token in _normalized_text([product, dimension]) for token in ("infrequent", "glacier", "intelligent", "vectors", "tables", "express"))
                ),
            ),
            (
                "standard-class-a-request",
                "request",
                lambda product, dimension: (
                    dimension.get("unit") == "Requests"
                    and any(token in dimension.get("description", "").lower() for token in ("put", "copy", "post", "list"))
                    and "data transfer" not in dimension.get("description", "").lower()
                ),
            ),
            (
                "standard-class-b-request",
                "request",
                lambda product, dimension: (
                    dimension.get("unit") == "Requests"
                    and any(token in dimension.get("description", "").lower() for token in ("get", "select"))
                    and "data transfer" not in dimension.get("description", "").lower()
                ),
            ),
        ]
        for sku, unit, predicate in rules:
            row = next(((product, dimension) for product, dimension in candidates if predicate(product, dimension)), None)
            if not row:
                warnings.append(f"AWS S3 {sku} price not found in {region}.")
                continue
            product, dimension = row
            items.append(_catalog_item(
                provider="aws",
                service="S3",
                sku=sku,
                description=dimension["description"] or sku,
                region=region,
                unit=unit,
                unit_price_usd=dimension["price"],
                source_url=url,
                source_type="aws_price_list_bulk_api",
                metadata={"awsSku": product.get("sku"), "sourceUnit": dimension["unit"]},
            ))

    if "elb" in offers:
        url, offer = offers["elb"]
        candidates = _aws_priced_products(
            offer,
            lambda product, dimension: "application" in _normalized_text([product, dimension]),
        )
        rules = [
            ("alb-hour", "hour", ("loadbalancer", "hour")),
            ("alb-lcu-hour", "lcu-hour", ("lcu",)),
        ]
        for sku, unit, tokens in rules:
            row = next((
                (product, dimension)
                for product, dimension in candidates
                if all(token in _normalized_text([product, dimension]) for token in tokens)
            ), None)
            if not row:
                warnings.append(f"AWS ALB {sku} price not found in {region}.")
                continue
            product, dimension = row
            items.append(_catalog_item(
                provider="aws",
                service="ALB",
                sku=sku,
                description=dimension["description"] or sku,
                region=region,
                unit=unit,
                unit_price_usd=dimension["price"],
                source_url=url,
                source_type="aws_price_list_bulk_api",
                metadata={"awsSku": product.get("sku")},
            ))

    return items, warnings


def _gcp_price_from_sku(sku: dict) -> tuple[float, str] | None:
    pricing = (sku.get("pricingInfo") or [{}])[0]
    expression = pricing.get("pricingExpression") or {}
    tiered = expression.get("tieredRates") or []
    if not tiered:
        return None
    unit_price = (tiered[0].get("unitPrice") or {})
    price = _to_float(unit_price.get("units")) + (_to_float(unit_price.get("nanos")) / 1_000_000_000)
    if price < 0:
        return None
    return price, expression.get("usageUnit") or expression.get("usageUnitDescription") or "unit"


GCP_API_KEY_ENV_VARS = (
    "GCP_PUBLIC_PRICING_API_KEY",
    "GCP_BILLING_CATALOG_API_KEY",
    "GOOGLE_API_KEY",
    "GCP_API_KEY",
)
GCP_API_KEY_FILE = os.path.join(os.path.dirname(__file__), ".gcp_api_key")


def resolve_gcp_api_key() -> str | None:
    for name in GCP_API_KEY_ENV_VARS:
        value = os.environ.get(name)
        if value and value.strip():
            return value.strip()
    if os.path.exists(GCP_API_KEY_FILE):
        try:
            with open(GCP_API_KEY_FILE) as fh:
                for line in fh:
                    candidate = line.strip()
                    if candidate and not candidate.startswith("#"):
                        return candidate
        except OSError as exc:
            print(f"  [warn] could not read {GCP_API_KEY_FILE}: {exc}", file=sys.stderr)
    return None


def _gcp_api_query(params: dict | None = None) -> str:
    params = dict(params or {})
    api_key = resolve_gcp_api_key()
    if api_key:
        params["key"] = api_key
    return urlencode(params)


def _gcp_service_map() -> dict[str, str]:
    url = f"{GCP_PUBLIC_BILLING_API}/services?{_gcp_api_query({'pageSize': '5000'})}"
    payload = _fetch_json_url(url) or {}
    return {
        item.get("displayName"): item.get("name")
        for item in payload.get("services", [])
        if item.get("displayName") and item.get("name")
    }


def _gcp_skus(service_name: str) -> list[dict]:
    rows: list[dict] = []
    page_token = ""
    while True:
        params = {"pageSize": "5000"}
        if page_token:
            params["pageToken"] = page_token
        payload = _fetch_json_url(f"{GCP_PUBLIC_BILLING_API}/{service_name}/skus?{_gcp_api_query(params)}") or {}
        rows.extend(payload.get("skus", []))
        page_token = payload.get("nextPageToken") or ""
        if not page_token:
            return rows


def _gcp_region_ok(sku: dict, region: str) -> bool:
    regions = sku.get("serviceRegions") or []
    return region in regions or "global" in regions or not regions


def _gcp_find_price(skus: list[dict], region: str, include: tuple[str, ...], exclude: tuple[str, ...] = ()) -> tuple[dict, float, str] | None:
    for sku in skus:
        text = _normalized_text(sku.get("description"))
        if not _gcp_region_ok(sku, region):
            continue
        if all(token in text for token in include) and not any(token in text for token in exclude):
            price = _gcp_price_from_sku(sku)
            if price:
                return sku, price[0], price[1]
    return None


def _text_from_html(html: str) -> str:
    try:
        from bs4 import BeautifulSoup

        return BeautifulSoup(html, "lxml").get_text(" ", strip=True)
    except Exception:
        return re.sub(r"<[^>]+>", " ", html)


def _prices_after(text: str, marker: str, limit: int = 6) -> list[float]:
    index = text.lower().find(marker.lower())
    if index < 0:
        return []
    return [float(value) for value in re.findall(r"\$\s*([0-9]+(?:\.[0-9]+)?)", text[index:index + 1200])[:limit]]


def build_gcp_docs_fallback_catalogue(config: dict, existing_items: list[dict]) -> tuple[list[dict], list[str]]:
    region = config["regions"]["gcp"]
    warnings: list[str] = []
    items: list[dict] = []

    def missing(service: str, sku: str) -> bool:
        return _first_catalog_item(existing_items + items, "gcp", service, sku) is None

    docs = {
        "run": "https://cloud.google.com/run/pricing",
        "storage": "https://cloud.google.com/storage/pricing",
        "logging": "https://cloud.google.com/logging/pricing",
        "load-balancing": "https://cloud.google.com/load-balancing/pricing",
        "compute": "https://cloud.google.com/compute/all-pricing",
    }
    html = {key: _fetch(url, timeout=25) or "" for key, url in docs.items()}
    text = {key: _text_from_html(value) for key, value in html.items() if value}

    compute_text = text.get("compute", "")
    e2_core = _prices_after(compute_text, "e2 predefined vcpus", 1) or _prices_after(compute_text, "e2 standard machine types predefined vcpus", 1)
    e2_memory = _prices_after(compute_text, "e2 predefined memory", 1) or _prices_after(compute_text, "e2 standard machine types predefined memory", 1)
    if e2_core and e2_memory:
        for machine_type in config["providers"]["gcp"]["computeMachineTypes"]:
            shape = GCP_MACHINE_SHAPES.get(machine_type)
            if not shape or not missing("Compute Engine", machine_type):
                continue
            hourly = shape["vcpu"] * e2_core[0] + shape["memoryGb"] * e2_memory[0]
            items.append(_catalog_item(
                provider="gcp",
                service="Compute Engine",
                sku=machine_type,
                description=f"{machine_type} Linux on-demand estimate from E2 docs vCPU and memory prices",
                region=region,
                unit="hour",
                unit_price_usd=hourly,
                source_url=docs["compute"],
                source_type="gcp_official_pricing_docs",
                metadata={"vcpu": shape["vcpu"], "memoryGb": shape["memoryGb"]},
            ))
    else:
        warnings.append("GCP Compute Engine E2 docs prices were not machine-readable; use GCP_PUBLIC_PRICING_API_KEY for official SKU rows.")

    run_text = text.get("run", "")
    run_cpu = _prices_after(run_text, "CPU (per vCPU-second)", 1)
    run_memory = _prices_after(run_text, "Memory (per GiB-second)", 1)
    if run_cpu and missing("Cloud Run", "vcpu-second"):
        items.append(_catalog_item(
            provider="gcp",
            service="Cloud Run",
            sku="vcpu-second",
            description="Cloud Run services CPU price from official docs",
            region=region,
            unit="vcpu-second",
            unit_price_usd=run_cpu[0],
            source_url=docs["run"],
            source_type="gcp_official_pricing_docs",
        ))
    if run_memory and missing("Cloud Run", "memory-gb-second"):
        items.append(_catalog_item(
            provider="gcp",
            service="Cloud Run",
            sku="memory-gb-second",
            description="Cloud Run services memory price from official docs",
            region=region,
            unit="gb-second",
            unit_price_usd=run_memory[0],
            source_url=docs["run"],
            source_type="gcp_official_pricing_docs",
        ))
    if missing("Cloud Run", "request"):
        warnings.append("GCP Cloud Run request price was not machine-readable from official docs.")

    logging_text = text.get("logging", "")
    logging_storage = _prices_after(logging_text, "Logging storage", 1)
    if logging_storage and missing("Cloud Logging", "logs-ingest-gb"):
        items.append(_catalog_item(
            provider="gcp",
            service="Cloud Logging",
            sku="logs-ingest-gb",
            description="Cloud Logging storage and ingestion price from official docs; includes default 30-day log bucket storage.",
            region=region,
            unit="GB",
            unit_price_usd=logging_storage[0],
            source_url=docs["logging"],
            source_type="gcp_official_pricing_docs",
        ))
    if missing("Cloud Logging", "logs-storage-gb-month"):
        items.append(_catalog_item(
            provider="gcp",
            service="Cloud Logging",
            sku="logs-storage-gb-month",
            description="Default Cloud Logging bucket retention is included for 30 days in the logged-data charge.",
            region=region,
            unit="GB-month",
            unit_price_usd=0,
            source_url=docs["logging"],
            source_type="gcp_official_pricing_docs",
            status="included",
        ))

    storage_text = text.get("storage", "")
    storage_prices = _prices_after(storage_text, "Standard storage", 5)
    if storage_prices and missing("Cloud Storage", "standard-storage-gb-month"):
        storage_price = storage_prices[0] * 730 if storage_prices[0] < 0.001 else storage_prices[0]
        items.append(_catalog_item(
            provider="gcp",
            service="Cloud Storage",
            sku="standard-storage-gb-month",
            description="Cloud Storage Standard single-region storage price from official docs",
            region=region,
            unit="GB-month",
            unit_price_usd=storage_price,
            source_url=docs["storage"],
            source_type="gcp_official_pricing_docs",
            metadata={"sourceUnit": "GiB-hour converted to monthly at 730 hours" if storage_prices[0] < 0.001 else "GB-month"},
        ))
    operation_index = storage_text.lower().find("operation charges")
    standard_index = storage_text.lower().find("standard storage", operation_index if operation_index >= 0 else 0)
    operation_prices = [
        float(value)
        for value in re.findall(r"\$\s*([0-9]+(?:\.[0-9]+)?)", storage_text[standard_index:standard_index + 400])
    ] if standard_index >= 0 else []
    if len(operation_prices) >= 3:
        if missing("Cloud Storage", "class-a-operation"):
            items.append(_catalog_item(
                provider="gcp",
                service="Cloud Storage",
                sku="class-a-operation",
                description="Cloud Storage Standard Class A flat namespace operation price from official docs",
                region=region,
                unit="operation",
                unit_price_usd=operation_prices[0] / 1000,
                source_url=docs["storage"],
                source_type="gcp_official_pricing_docs",
                metadata={"sourceUnit": "per 1,000 operations"},
            ))
        if missing("Cloud Storage", "class-b-operation"):
            items.append(_catalog_item(
                provider="gcp",
                service="Cloud Storage",
                sku="class-b-operation",
                description="Cloud Storage Standard Class B flat namespace operation price from official docs",
                region=region,
                unit="operation",
                unit_price_usd=operation_prices[2] / 1000,
                source_url=docs["storage"],
                source_type="gcp_official_pricing_docs",
                metadata={"sourceUnit": "per 1,000 operations"},
            ))
    else:
        warnings.append("GCP Cloud Storage operation prices were not machine-readable from official docs.")

    load_balancing_text = text.get("load-balancing", "")
    forwarding = _prices_after(load_balancing_text, "First 5 forwarding rules", 1)
    if forwarding and missing("Cloud Load Balancing", "forwarding-rule-hour"):
        items.append(_catalog_item(
            provider="gcp",
            service="Cloud Load Balancing",
            sku="forwarding-rule-hour",
            description="Cloud Load Balancing first five forwarding rules price from official docs",
            region=region,
            unit="hour",
            unit_price_usd=forwarding[0],
            source_url=docs["load-balancing"],
            source_type="gcp_official_pricing_docs",
        ))
    if missing("Cloud Load Balancing", "data-processing-gb"):
        warnings.append("GCP Cloud Load Balancing regional data-processing price was not machine-readable from official docs.")

    return items, warnings


def build_gcp_public_catalogue(config: dict) -> tuple[list[dict], list[str]]:
    region = config["regions"]["gcp"]
    service_map = _gcp_service_map()
    wanted = {
        "Compute Engine": "compute",
        "Cloud Run": "run",
        "Cloud Logging": "logging",
        "Cloud Storage": "storage",
        "Cloud Load Balancing": "load-balancing",
    }
    service_skus: dict[str, list[dict]] = {}
    warnings: list[str] = []
    if not service_map:
        warnings.append("GCP Cloud Billing Pricing API returned no services; using official pricing-doc fallback. Set GCP_PUBLIC_PRICING_API_KEY for SKU-level API rows.")
    else:
        for display, key in wanted.items():
            service_name = service_map.get(display)
            if not service_name:
                warnings.append(f"GCP service {display} not found in public billing catalogue.")
                continue
            service_skus[key] = _gcp_skus(service_name)

    items: list[dict] = []
    source_url = f"{GCP_PUBLIC_BILLING_API}/services/*/skus"

    compute_skus = service_skus.get("compute") or []
    core = _gcp_find_price(compute_skus, region, ("e2", "core"), ("spot", "preemptible", "sole tenancy"))
    memory = _gcp_find_price(compute_skus, region, ("e2", "ram"), ("spot", "preemptible", "sole tenancy"))
    if not memory:
        memory = _gcp_find_price(compute_skus, region, ("e2", "memory"), ("spot", "preemptible", "sole tenancy"))
    if core and memory:
        for machine_type in config["providers"]["gcp"]["computeMachineTypes"]:
            shape = GCP_MACHINE_SHAPES.get(machine_type)
            if not shape:
                warnings.append(f"GCP shape for {machine_type} is not configured.")
                continue
            hourly = (shape["vcpu"] * core[1]) + (shape["memoryGb"] * memory[1])
            items.append(_catalog_item(
                provider="gcp",
                service="Compute Engine",
                sku=machine_type,
                description=f"{machine_type} Linux on-demand estimate from E2 core and RAM SKUs",
                region=region,
                unit="hour",
                unit_price_usd=hourly,
                source_url=source_url,
                source_type="gcp_cloud_billing_catalog_api",
                metadata={
                    "coreSkuId": core[0].get("skuId"),
                    "memorySkuId": memory[0].get("skuId"),
                    "vcpu": shape["vcpu"],
                    "memoryGb": shape["memoryGb"],
                },
            ))
    elif compute_skus:
        warnings.append(f"GCP E2 core/RAM prices not found for {region}.")

    gcp_rules = [
        ("run", "Cloud Run", "vcpu-second", "vcpu-second", ("cloud run", "cpu"), ("commitment",)),
        ("run", "Cloud Run", "memory-gb-second", "gb-second", ("cloud run", "memory"), ("commitment",)),
        ("run", "Cloud Run", "request", "request", ("cloud run", "request"), ()),
        ("logging", "Cloud Logging", "logs-ingest-gb", "GB", ("log", "ingest"), ()),
        ("logging", "Cloud Logging", "logs-storage-gb-month", "GB-month", ("log", "storage"), ()),
        ("storage", "Cloud Storage", "standard-storage-gb-month", "GB-month", ("standard", "storage"), ("nearline", "coldline", "archive")),
        ("storage", "Cloud Storage", "class-a-operation", "operation", ("class a",), ()),
        ("storage", "Cloud Storage", "class-b-operation", "operation", ("class b",), ()),
        ("load-balancing", "Cloud Load Balancing", "forwarding-rule-hour", "hour", ("forwarding", "rule"), ()),
        ("load-balancing", "Cloud Load Balancing", "data-processing-gb", "GB", ("data", "processing"), ()),
    ]
    for key, service, sku_name, unit, include, exclude in gcp_rules:
        if key not in service_skus:
            continue
        row = _gcp_find_price(service_skus.get(key) or [], region, include, exclude)
        if not row:
            warnings.append(f"GCP {service} {sku_name} price not found for {region}.")
            continue
        sku, price, source_unit = row
        items.append(_catalog_item(
            provider="gcp",
            service=service,
            sku=sku_name,
            description=sku.get("description") or sku_name,
            region=region,
            unit=unit,
            unit_price_usd=price,
            source_url=source_url,
            source_type="gcp_cloud_billing_catalog_api",
            metadata={"skuId": sku.get("skuId"), "sourceUnit": source_unit},
        ))

    fallback_items, fallback_warnings = build_gcp_docs_fallback_catalogue(config, items)
    items.extend(fallback_items)
    warnings.extend(fallback_warnings)
    return items, warnings


def _azure_retail_items(filter_parts: list[str]) -> list[dict]:
    rows: list[dict] = []
    params = {
        "api-version": "2023-01-01-preview",
        "$filter": " and ".join(filter_parts),
    }
    url = f"{AZURE_RETAIL_PRICES_API}?{urlencode(params)}"
    while url:
        payload = _fetch_json_url(url) or {}
        rows.extend(payload.get("Items", []))
        url = payload.get("NextPageLink")
    return rows


def _azure_price_row(rows: list[dict], include: tuple[str, ...], exclude: tuple[str, ...] = ()) -> dict | None:
    matches: list[dict] = []
    for row in rows:
        text = _normalized_text(row)
        if all(token in text for token in include) and not any(token in text for token in exclude):
            if _to_float(row.get("unitPrice"), -1) >= 0:
                matches.append(row)
    positive = [row for row in matches if _to_float(row.get("unitPrice"), 0) > 0]
    return (positive or matches or [None])[0]


def build_azure_public_catalogue(config: dict) -> tuple[list[dict], list[str]]:
    region = config["regions"]["azure"]
    warnings: list[str] = []
    items: list[dict] = []
    source_url = AZURE_RETAIL_PRICES_API

    base_filter = [
        "currencyCode eq 'USD'",
        "priceType eq 'Consumption'",
        f"armRegionName eq '{region}'",
    ]
    vm_rows = _azure_retail_items(base_filter + ["serviceName eq 'Virtual Machines'"])
    for sku in config["providers"]["azure"]["vmSkus"]:
        row = _azure_price_row(
            vm_rows,
            (sku.lower(),),
            ("windows", "spot", "low priority", "reservation"),
        )
        if not row:
            warnings.append(f"Azure VM {sku} price not found for {region}.")
            continue
        items.append(_catalog_item(
            provider="azure",
            service="Virtual Machines",
            sku=sku,
            description=row.get("productName") or row.get("meterName") or sku,
            region=region,
            unit="hour",
            unit_price_usd=_to_float(row.get("unitPrice")),
            source_url=source_url,
            source_type="azure_retail_prices_api",
            metadata={"meterId": row.get("meterId"), "armSkuName": row.get("armSkuName"), "unitOfMeasure": row.get("unitOfMeasure")},
        ))

    aks_node_sku = config["providers"]["azure"]["aksNodeSku"]
    vm_for_aks = _first_catalog_item(items, "azure", "Virtual Machines", aks_node_sku)
    if vm_for_aks:
        items.append(_catalog_item(
            provider="azure",
            service="AKS",
            sku=f"node-{aks_node_sku}",
            description=f"AKS node pool VM cost using {aks_node_sku}",
            region=region,
            unit="hour",
            unit_price_usd=vm_for_aks["unitPriceUsd"],
            source_url=source_url,
            source_type="azure_retail_prices_api",
            metadata={"derivedFrom": aks_node_sku},
        ))
    else:
        warnings.append(f"Azure AKS node price could not be derived from {aks_node_sku}.")

    monitor_rows = (
        _azure_retail_items(base_filter + ["serviceName eq 'Azure Monitor'"])
        + _azure_retail_items(base_filter + ["serviceName eq 'Log Analytics'"])
    )
    azure_rules = [
        (monitor_rows, "Log Analytics Workspace", "logs-ingest-gb", "GB", ("data ingestion",), ("basic", "auxiliary", "archive", "free benefit", "trial", "sentinel")),
        (monitor_rows, "Log Analytics Workspace", "logs-retention-gb-month", "GB-month", ("retention",), ("archive",)),
        (_azure_retail_items(base_filter + ["serviceName eq 'Storage'"]), "Blob Storage", "hot-lrs-storage-gb-month", "GB-month", ("hot", "lrs", "data stored"), ("cool", "archive", "premium")),
        (_azure_retail_items(base_filter + ["serviceName eq 'Application Gateway'"]), "Application Gateway", "standard-v2-hour", "hour", ("standard", "v2", "gateway"), ("waf",)),
        (_azure_retail_items(base_filter + ["serviceName eq 'Application Gateway'"]), "Application Gateway", "capacity-unit-hour", "capacity-unit-hour", ("capacity", "unit"), ("waf",)),
    ]
    for rows, service, sku, unit, include, exclude in azure_rules:
        row = _azure_price_row(rows, include, exclude)
        if not row:
            warnings.append(f"Azure {service} {sku} price not found for {region}.")
            continue
        items.append(_catalog_item(
            provider="azure",
            service=service,
            sku=sku,
            description=row.get("productName") or row.get("meterName") or sku,
            region=region,
            unit=unit,
            unit_price_usd=_to_float(row.get("unitPrice")),
            source_url=source_url,
            source_type="azure_retail_prices_api",
            metadata={"meterId": row.get("meterId"), "meterName": row.get("meterName"), "unitOfMeasure": row.get("unitOfMeasure")},
        ))

    return items, warnings


def _cloudflare_doc_rows(url: str) -> tuple[str, list[dict]]:
    html = _fetch(url, timeout=25) or ""
    return html, _parse_pricing_tables(html, url) if html else []


def _row_text(row: dict) -> str:
    return " | ".join(str(value) for value in row.values())


def _cloudflare_table_price(rows: list[dict], include: tuple[str, ...], exclude: tuple[str, ...] = ()) -> float | None:
    for row in rows:
        text = _row_text(row).lower()
        if all(token in text for token in include) and not any(token in text for token in exclude):
            return _money_from_text(_row_text(row))
    return None


def build_cloudflare_public_catalogue(config: dict) -> tuple[list[dict], list[str]]:
    region = config["regions"]["cloudflare"]
    warnings: list[str] = []
    items: list[dict] = []
    workers_url = "https://developers.cloudflare.com/workers/platform/pricing/"
    r2_url = "https://developers.cloudflare.com/r2/pricing/"
    plans_url = "https://www.cloudflare.com/plans/"

    workers_html, workers_rows = _cloudflare_doc_rows(workers_url)
    r2_html, r2_rows = _cloudflare_doc_rows(r2_url)

    minimum_index = workers_html.lower().find("minimum charge") if workers_html else -1
    workers_base = _money_from_text(workers_html[minimum_index:]) if minimum_index >= 0 else None
    workers_request = _cloudflare_table_price(workers_rows, ("requests", "additional million"))
    workers_cpu = _cloudflare_table_price(workers_rows, ("cpu", "additional million"))
    if workers_html:
        request_match = re.search(r"Requests.*?\+\$([0-9.]+)\s*per additional million", workers_html, re.IGNORECASE | re.DOTALL)
        if request_match:
            workers_request = float(request_match.group(1))
        cpu_match = re.search(r"CPU time.*?\+\$([0-9.]+)\s*per additional million CPU milliseconds", workers_html, re.IGNORECASE | re.DOTALL)
        if cpu_match:
            workers_cpu = float(cpu_match.group(1))
    logpush = _cloudflare_table_price(workers_rows, ("$0.05", "million"))

    cf_rows = [
        ("Workers", "paid-plan-minimum", "month", workers_base, "Workers Paid plan monthly minimum"),
        ("Workers", "request-million", "million-requests", workers_request, "Workers Standard request overage"),
        ("Workers", "cpu-million-ms", "million-cpu-ms", workers_cpu, "Workers Standard CPU overage"),
        ("Logpush", "workers-logpush-million", "million-requests", logpush, "Workers Trace Events Logpush overage"),
        ("R2", "standard-storage-gb-month", "GB-month", _cloudflare_table_price(r2_rows, ("storage", "gb-month"), ("infrequent",)), "R2 Standard storage"),
        ("R2", "class-a-million-operations", "million-operations", _cloudflare_table_price(r2_rows, ("class a", "million")), "R2 Class A operations"),
        ("R2", "class-b-million-operations", "million-operations", _cloudflare_table_price(r2_rows, ("class b", "million")), "R2 Class B operations"),
    ]

    for service, sku, unit, price, description in cf_rows:
        if price is None:
            warnings.append(f"Cloudflare {service} {sku} price not found in official docs.")
            continue
        items.append(_catalog_item(
            provider="cloudflare",
            service=service,
            sku=sku,
            description=description,
            region=region,
            unit=unit,
            unit_price_usd=price,
            source_url=workers_url if service in {"Workers", "Logpush"} else r2_url,
            source_type="cloudflare_official_pricing_docs",
        ))

    items.append(_catalog_item(
        provider="cloudflare",
        service="Load Balancing",
        sku="included-or-plan-dependent",
        description="Cloudflare load balancing is modeled as included or plan-dependent for this budget view.",
        region=region,
        unit="included",
        unit_price_usd=0,
        source_url=plans_url,
        source_type="cloudflare_official_pricing_docs",
        status="included_or_plan_dependent",
        metadata={"note": "No regional unit price is applied by default."},
    ))

    return items, warnings


def build_public_pricing_catalogue(config: dict) -> dict:
    generated_at = utc_now_iso()
    all_items: list[dict] = []
    warnings: list[str] = []
    builders = [
        ("AWS", build_aws_public_catalogue),
        ("GCP", build_gcp_public_catalogue),
        ("Azure", build_azure_public_catalogue),
        ("Cloudflare", build_cloudflare_public_catalogue),
    ]

    for label, builder in builders:
        print(f"[....] {label} public pricing ...", file=sys.stderr)
        try:
            items, provider_warnings = builder(config)
            all_items.extend(items)
            warnings.extend(provider_warnings)
            print(f"  {label}: {len(items)} normalized price row(s)", file=sys.stderr)
        except Exception as exc:
            warning = f"{label} pricing build failed: {exc}"
            warnings.append(warning)
            print(f"  [warn] {warning}", file=sys.stderr)

    return {
        "schemaVersion": 1,
        "kind": "public_cloud_pricing_catalogue",
        "generatedAt": generated_at,
        "currency": "USD",
        "sourcePolicy": "official_public_apis_docs",
        "regions": config["regions"],
        "items": all_items,
        "warnings": warnings,
        "sourceNotes": [
            "AWS prices come from the public AWS Price List Bulk API files.",
            "GCP prices come from the public Cloud Billing Catalog API where available.",
            "Azure prices come from the unauthenticated Azure Retail Prices API.",
            "Cloudflare prices come from official Cloudflare pricing documentation.",
        ],
    }


def _units(config: dict, *path: str) -> float:
    value: object = config
    for key in path:
        if not isinstance(value, dict):
            return 0.0
        value = value.get(key)
    return _to_float(value)


def _estimate_line(
    rows: list[dict],
    *,
    provider: str,
    service: str,
    sku: str,
    quantity: float,
    quantity_unit: str,
    notes: str = "",
) -> tuple[dict | None, str | None]:
    row = _first_catalog_item(rows, provider, service, sku)
    if not row or row.get("unitPriceUsd") is None:
        return None, f"{provider}/{service}/{sku} has no official price row."
    cost = quantity * float(row["unitPriceUsd"])
    return {
        "provider": provider,
        "service": service,
        "sku": sku,
        "description": row["description"],
        "quantity": round(quantity, 6),
        "quantityUnit": quantity_unit,
        "unit": row["unit"],
        "unitPriceUsd": row["unitPriceUsd"],
        "monthlyCostUsd": round(cost, 6),
        "sourceUrl": row["sourceUrl"],
        "sourceType": row["sourceType"],
        "notes": notes,
    }, None


def build_public_pricing_estimates(catalogue: dict, config: dict, months: int = 6) -> dict:
    rows = catalogue.get("items") or []
    usage = config["usage"]
    line_items: list[dict] = []
    warnings = list(catalogue.get("warnings") or [])
    unpriced: list[str] = []

    def add(provider: str, service: str, sku: str, quantity: float, quantity_unit: str, notes: str = "") -> None:
        line, warning = _estimate_line(
            rows,
            provider=provider,
            service=service,
            sku=sku,
            quantity=quantity,
            quantity_unit=quantity_unit,
            notes=notes,
        )
        if warning:
            unpriced.append(warning)
            return
        line_items.append(line)

    compute_hours = _units(config, "usage", "compute", "hoursPerMonth")
    compute_count = _units(config, "usage", "compute", "instanceCount")
    add("aws", "EC2", config["providers"]["aws"]["ec2DefaultInstanceType"], compute_hours * compute_count, "instance-hours")
    add("gcp", "Compute Engine", config["providers"]["gcp"]["computeDefaultMachineType"], compute_hours * compute_count, "instance-hours")
    add("azure", "Virtual Machines", config["providers"]["azure"]["vmDefaultSku"], compute_hours * compute_count, "instance-hours")

    add(
        "aws",
        "ECS Fargate",
        "fargate-vcpu-hour",
        _units(config, "usage", "ecsFargate", "vcpu") * _units(config, "usage", "ecsFargate", "hoursPerMonth") * _units(config, "usage", "ecsFargate", "taskCount"),
        "vcpu-hours",
    )
    add(
        "aws",
        "ECS Fargate",
        "fargate-memory-gb-hour",
        _units(config, "usage", "ecsFargate", "memoryGb") * _units(config, "usage", "ecsFargate", "hoursPerMonth") * _units(config, "usage", "ecsFargate", "taskCount"),
        "gb-hours",
    )
    add(
        "gcp",
        "Cloud Run",
        "vcpu-second",
        _units(config, "usage", "cloudRun", "vcpuSecondsPerMonth"),
        "vcpu-seconds",
    )
    add(
        "gcp",
        "Cloud Run",
        "memory-gb-second",
        _units(config, "usage", "cloudRun", "memoryGbSecondsPerMonth"),
        "gb-seconds",
    )
    add("gcp", "Cloud Run", "request", _units(config, "usage", "cloudRun", "requestsPerMonth"), "requests")
    add(
        "azure",
        "AKS",
        f"node-{config['providers']['azure']['aksNodeSku']}",
        _units(config, "usage", "aks", "nodeCount") * _units(config, "usage", "aks", "hoursPerMonth"),
        "node-hours",
        "AKS estimate models worker-node VM cost; public control-plane cost is not added unless priced.",
    )

    add("aws", "CloudWatch Logs", "logs-ingest-gb", _units(config, "usage", "logs", "ingestGbPerMonth"), "GB")
    add("aws", "CloudWatch Logs", "logs-storage-gb-month", _units(config, "usage", "logs", "retentionGbMonth"), "GB-month")
    add("gcp", "Cloud Logging", "logs-ingest-gb", _units(config, "usage", "logs", "ingestGbPerMonth"), "GB")
    add("gcp", "Cloud Logging", "logs-storage-gb-month", _units(config, "usage", "logs", "retentionGbMonth"), "GB-month")
    add("azure", "Log Analytics Workspace", "logs-ingest-gb", _units(config, "usage", "logs", "ingestGbPerMonth"), "GB")
    add("azure", "Log Analytics Workspace", "logs-retention-gb-month", _units(config, "usage", "logs", "retentionGbMonth"), "GB-month")
    add("cloudflare", "Logpush", "workers-logpush-million", _units(config, "usage", "logs", "logpushRequestsPerMonth") / 1_000_000, "million requests")

    add("aws", "S3", "standard-storage-gb-month", _units(config, "usage", "storage", "storageGbMonth"), "GB-month")
    add("aws", "S3", "standard-class-a-request", _units(config, "usage", "storage", "classAOperationsPerMonth"), "requests")
    add("aws", "S3", "standard-class-b-request", _units(config, "usage", "storage", "classBOperationsPerMonth"), "requests")
    add("gcp", "Cloud Storage", "standard-storage-gb-month", _units(config, "usage", "storage", "storageGbMonth"), "GB-month")
    add("gcp", "Cloud Storage", "class-a-operation", _units(config, "usage", "storage", "classAOperationsPerMonth"), "operations")
    add("gcp", "Cloud Storage", "class-b-operation", _units(config, "usage", "storage", "classBOperationsPerMonth"), "operations")
    add("azure", "Blob Storage", "hot-lrs-storage-gb-month", _units(config, "usage", "storage", "storageGbMonth"), "GB-month")
    add("cloudflare", "R2", "standard-storage-gb-month", _units(config, "usage", "storage", "storageGbMonth"), "GB-month")
    add("cloudflare", "R2", "class-a-million-operations", _units(config, "usage", "storage", "classAOperationsPerMonth") / 1_000_000, "million operations")
    add("cloudflare", "R2", "class-b-million-operations", _units(config, "usage", "storage", "classBOperationsPerMonth") / 1_000_000, "million operations")

    lb_hours = _units(config, "usage", "loadBalancer", "hoursPerMonth") * _units(config, "usage", "loadBalancer", "count")
    add("aws", "ALB", "alb-hour", lb_hours, "load-balancer-hours")
    add("aws", "ALB", "alb-lcu-hour", _units(config, "usage", "loadBalancer", "lcuHoursPerMonth"), "LCU-hours")
    add("gcp", "Cloud Load Balancing", "forwarding-rule-hour", lb_hours, "forwarding-rule-hours")
    add("gcp", "Cloud Load Balancing", "data-processing-gb", _units(config, "usage", "loadBalancer", "dataGbPerMonth"), "GB")
    add("azure", "Application Gateway", "standard-v2-hour", lb_hours, "gateway-hours")
    add("azure", "Application Gateway", "capacity-unit-hour", _units(config, "usage", "loadBalancer", "lcuHoursPerMonth"), "capacity-unit-hours")
    add("cloudflare", "Load Balancing", "included-or-plan-dependent", 1, "included")

    add("cloudflare", "Workers", "paid-plan-minimum", 1, "month")
    workers_requests = _units(config, "usage", "workers", "requestsPerMonth")
    workers_cpu = _units(config, "usage", "workers", "cpuMillisecondsPerMonth")
    request_billable = max(0.0, workers_requests - 10_000_000) if config.get("applyFreeTier") else workers_requests
    cpu_billable = max(0.0, workers_cpu - 30_000_000) if config.get("applyFreeTier") else workers_cpu
    add("cloudflare", "Workers", "request-million", request_billable / 1_000_000, "million requests")
    add("cloudflare", "Workers", "cpu-million-ms", cpu_billable / 1_000_000, "million CPU milliseconds")

    provider_totals: dict[str, float] = {provider: 0.0 for provider in CLOUD_PROVIDER_IDS}
    service_totals: list[dict] = []
    for line in line_items:
        provider_totals[line["provider"]] = provider_totals.get(line["provider"], 0.0) + line["monthlyCostUsd"]

    for provider in CLOUD_PROVIDER_IDS:
        by_service: dict[str, float] = {}
        for line in line_items:
            if line["provider"] == provider:
                by_service[line["service"]] = by_service.get(line["service"], 0.0) + line["monthlyCostUsd"]
        for service, total in sorted(by_service.items(), key=lambda pair: pair[1], reverse=True):
            service_totals.append({
                "provider": provider,
                "service": service,
                "monthlyCostUsd": round(total, 6),
            })

    current_total = sum(provider_totals.values())
    priced_count = len(line_items)
    unpriced_count = len(unpriced)
    coverage = priced_count / (priced_count + unpriced_count) * 100 if priced_count or unpriced_count else 0
    warnings.extend(unpriced)
    risk = "HIGH" if unpriced_count else "MEDIUM"

    monthly_budget = []
    chart = []
    for index, window in enumerate(forecast_month_windows(months)):
        baseline = current_total
        optimized = current_total * (0.94 if index == 0 else 0.88)
        point = {
            "month": window["key"],
            "label": window["label"],
            "cloud": round(baseline / 1000, 2),
            "baseline": round(baseline / 1000, 2),
            "optimized": round(optimized / 1000, 2),
            "runRate": round(current_total / 1000, 2),
            "isActual": True,
            "estimatedPct": round(100 - coverage, 1),
        }
        monthly_budget.append(point)
        chart.append({
            "label": point["label"],
            "baseline": point["baseline"],
            "optimized": point["optimized"],
            "runRate": point["runRate"],
        })

    service_spend = [
        {
            "label": PROVIDER_LABELS.get(provider, provider),
            "value": round(total / 1000, 2),
            "color": PROVIDER_COLORS.get(provider, "#64748b"),
            "isEstimated": False,
            "sourceKind": "public_pricing",
        }
        for provider, total in sorted(provider_totals.items(), key=lambda pair: pair[1], reverse=True)
        if total > 0
    ]
    providers = [
        {
            "id": provider,
            "label": PROVIDER_LABELS.get(provider, provider),
            "currentAmount": round(total, 2),
            "runRateAmount": round(total, 2),
            "previousAmount": 0,
            "trendPct": 0,
            "isEstimated": False,
            "sourceKind": "public_pricing",
            "warnings": [warning for warning in warnings if warning.lower().startswith(provider)],
        }
        for provider, total in provider_totals.items()
        if total > 0
    ]
    source_rows = [
        [PROVIDER_LABELS.get(provider, provider), "Official public price", config["regions"].get(provider, "global")]
        for provider, total in provider_totals.items()
        if total > 0
    ]

    six_month_total = current_total * months
    optimized_total = monthly_budget[0]["optimized"] * 1000 + max(0, months - 1) * current_total * 0.88 if monthly_budget else 0
    scenarios = [
        {
            "id": "public-price-baseline",
            "prompt": "Use official public retail pricing",
            "headline": "Budget is estimated from public retail prices and editable usage quantities.",
            "summary": "This is a hypothetical purchase model: it answers what these common cloud services would cost in the selected European regions.",
            "numbers": [
                ["Monthly estimate", format_compact_usd(current_total)],
                ["Six-month estimate", format_compact_usd(six_month_total)],
                ["Priced line items", str(priced_count)],
                ["Price coverage", f"{coverage:.0f}%"],
            ],
            "risk": risk,
            "keyRisk": "Unpriced rows are excluded from totals; review warnings before relying on a provider comparison.",
            "recommendations": [
                "Adjust src/data/cloud-pricing/inputs.json to match expected usage.",
                "Rerun python scraper.py --pricing-estimates before each planning review.",
                "Treat taxes, credits, commitments, and negotiated discounts as out of scope.",
            ],
            "confidence": int(clamp(coverage, 25, 95)),
            "basedOn": [
                "Official public pricing APIs and docs",
                f"{priced_count} priced line item(s)",
                f"{unpriced_count} unpriced line item(s)",
            ],
            "metrics": {
                "infraCost": format_compact_usd(current_total),
                "forecast": format_compact_usd(six_month_total),
                "savings": "$0",
                "confidence": f"{coverage:.0f}% priced",
            },
            "chart": chart,
        },
        {
            "id": "optimization",
            "prompt": "Apply a 12% usage reduction target",
            "headline": "Reducing forecast usage lowers the six-month public-price budget.",
            "summary": "The optimizer keeps current-month usage at a 6% reduction and applies a 12% reduction to later months.",
            "numbers": [
                ["Potential six-month savings", format_compact_usd(max(0, six_month_total - optimized_total))],
                ["Optimized monthly target", format_compact_usd(current_total * 0.88)],
                ["Monthly estimate", format_compact_usd(current_total)],
                ["Price coverage", f"{coverage:.0f}%"],
            ],
            "risk": "MEDIUM" if unpriced_count else "LOW",
            "keyRisk": "Savings are directional because the model uses simple quantities, not autoscaling or invoice exports.",
            "recommendations": [
                "Start with compute hours, log ingestion, and load balancer capacity.",
                "Update usage quantities before comparing providers.",
                "Keep unpriced services separate from savings claims.",
            ],
            "confidence": int(clamp(coverage - 5, 20, 90)),
            "basedOn": [
                "12% reduction on forecast months",
                f"{format_compact_usd(current_total)} monthly estimate",
                f"{coverage:.0f}% public-price coverage",
            ],
            "metrics": {
                "infraCost": format_compact_usd(current_total),
                "forecast": format_compact_usd(optimized_total),
                "savings": format_compact_usd(max(0, six_month_total - optimized_total)),
                "confidence": f"{coverage:.0f}% priced",
            },
            "chart": chart,
        },
        {
            "id": "usage-spike",
            "prompt": "What if usage is 25% higher?",
            "headline": "A 25% usage increase raises the public-price budget immediately.",
            "summary": "This stress case multiplies the monthly estimate by 1.25 across the six-month horizon.",
            "numbers": [
                ["Spike monthly estimate", format_compact_usd(current_total * 1.25)],
                ["Extra monthly cost", format_compact_usd(current_total * 0.25)],
                ["Six-month stress total", format_compact_usd(six_month_total * 1.25)],
                ["Price coverage", f"{coverage:.0f}%"],
            ],
            "risk": "HIGH",
            "keyRisk": "Storage operations, logs, and load balancer capacity can scale differently than compute hours.",
            "recommendations": [
                "Model expected request and log volume explicitly.",
                "Keep egress and managed database pricing out until their usage is known.",
                "Use this stress case as a budget guardrail, not an invoice prediction.",
            ],
            "confidence": int(clamp(coverage - 10, 20, 85)),
            "basedOn": [
                "25% usage multiplier",
                f"{format_compact_usd(current_total)} baseline monthly estimate",
                f"{unpriced_count} unpriced line item(s)",
            ],
            "metrics": {
                "infraCost": format_compact_usd(current_total * 1.25),
                "forecast": format_compact_usd(six_month_total * 1.25),
                "savings": "$0",
                "confidence": f"{coverage:.0f}% priced",
            },
            "chart": [
                {
                    "label": point["label"],
                    "baseline": round(point["baseline"] * 1.25, 2),
                    "optimized": point["optimized"],
                    "runRate": round(point["runRate"] * 1.25, 2),
                }
                for point in chart
            ],
        },
    ]

    return {
        "schemaVersion": 1,
        "kind": "public_cloud_pricing_estimate",
        "generatedAt": utc_now_iso(),
        "currency": "USD",
        "sourcePolicy": "official_public_apis_docs",
        "horizonMonths": months,
        "input": config,
        "summary": {
            "currentMonthlyCost": round(current_total, 2),
            "previousMonthlyCost": 0,
            "trendPct": 0,
            "nextMonthForecast": round(current_total, 2),
            "sixMonthForecastTotal": round(six_month_total, 2),
            "optimizedSixMonthTotal": round(optimized_total, 2),
            "actualCoveragePct": round(coverage, 1),
            "estimatedCoveragePct": round(100 - coverage, 1),
            "risk": risk,
        },
        "providers": providers,
        "sourceRows": source_rows,
        "monthlyBudget": monthly_budget,
        "serviceSpend": service_spend,
        "chart": chart,
        "scenarios": scenarios,
        "warnings": warnings,
        "estimateRows": service_totals,
        "lineItems": line_items,
        "unpricedItems": unpriced,
        "catalogue": {
            "itemsCount": len(rows),
            "pricedLineItems": priced_count,
            "unpricedLineItems": unpriced_count,
        },
    }


def run_public_pricing_estimates(config_path: str = PUBLIC_PRICING_INPUT_FILE) -> None:
    write_default_public_pricing_inputs(config_path)
    config = load_public_pricing_inputs(config_path)
    catalogue = build_public_pricing_catalogue(config)
    estimates = build_public_pricing_estimates(catalogue, config)

    os.makedirs(PUBLIC_PRICING_DIR, exist_ok=True)
    with open(PUBLIC_PRICING_CATALOGUE_FILE, "w") as fh:
        json.dump(catalogue, fh, indent=2)
        fh.write("\n")
    with open(PUBLIC_PRICING_ESTIMATES_FILE, "w") as fh:
        json.dump(estimates, fh, indent=2)
        fh.write("\n")

    print(f"\nWrote {PUBLIC_PRICING_INPUT_FILE}", file=sys.stderr)
    print(f"Wrote {PUBLIC_PRICING_CATALOGUE_FILE}", file=sys.stderr)
    print(f"Wrote {PUBLIC_PRICING_ESTIMATES_FILE}", file=sys.stderr)


def run_pricing() -> None:
    print("[....] CLOUDFLARE pricing ...", file=sys.stderr)
    cf = scrape_cloudflare_pricing()
    print("[....] GCP pricing ...", file=sys.stderr)
    gcp = scrape_gcp_pricing()

    catalogue = {"cloudflare": cf, "gcp": gcp}

    os.makedirs(PUBLIC_PRICING_DIR, exist_ok=True)
    with open(PRICING_OUT_FILE, "w") as fh:
        json.dump(catalogue, fh, indent=2)

    print(f"\nWrote {PRICING_OUT_FILE}", file=sys.stderr)
    print("\n── Pricing catalogue preview ──", file=sys.stderr)
    print(json.dumps(catalogue, indent=2)[:4000], file=sys.stderr)
    print("...(truncated)" if len(json.dumps(catalogue)) > 4000 else "", file=sys.stderr)


# ── cloud budget forecast ─────────────────────────────────────────────────────

CLOUD_PROVIDER_IDS = ("aws", "gcp", "azure", "cloudflare")
PROVIDER_LABELS = {
    "aws": "AWS",
    "gcp": "GCP",
    "azure": "Azure",
    "cloudflare": "Cloudflare",
}
PROVIDER_COLORS = {
    "aws": "#2563eb",
    "gcp": "#16a34a",
    "azure": "#7c3aed",
    "cloudflare": "#f59e0b",
}


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def amount_from_provider(payload: dict) -> tuple[float, float, bool, str]:
    actual = payload.get("costActual") if isinstance(payload.get("costActual"), dict) else {}
    current = float(actual.get("amount") or money_to_float(payload.get("monthlySpend")))
    previous = float(actual.get("previousAmount") or money_to_float(payload.get("previousSpend")))
    source = payload.get("source") if isinstance(payload.get("source"), dict) else {}
    source_kind = str(source.get("kind") or "legacy_unverified")
    is_estimated = bool(actual.get("isEstimated", source_kind not in {"actual", "partial_actual"}))
    return current, previous, is_estimated, source_kind


def normalized_run_rate(payload: dict, current: float, today: date | None = None) -> float:
    today = today or date.today()
    source = payload.get("source") if isinstance(payload.get("source"), dict) else {}
    period = source.get("billingPeriod") if isinstance(source.get("billingPeriod"), dict) else {}
    start_raw = period.get("start")
    end_raw = period.get("endExclusive")
    if not start_raw or not end_raw:
        return current

    try:
        start = datetime.fromisoformat(str(start_raw)).date()
        end_exclusive = datetime.fromisoformat(str(end_raw)).date()
    except ValueError:
        return current

    if month_start(start) != month_start(today):
        return current
    if end_exclusive > today + timedelta(days=1):
        return current

    elapsed_days = max(1, min((end_exclusive - start).days, today.day))
    days_in_month = monthrange(today.year, today.month)[1]
    return current / elapsed_days * days_in_month


def provider_records(provider_data: dict, today: date | None = None) -> list[dict]:
    records: list[dict] = []
    for provider_id in CLOUD_PROVIDER_IDS:
        payload = provider_data.get(provider_id)
        if not isinstance(payload, dict):
            continue

        current, previous, is_estimated, source_kind = amount_from_provider(payload)
        if current <= 0 and previous <= 0:
            continue

        run_rate = normalized_run_rate(payload, current, today)
        records.append({
            "id": provider_id,
            "label": PROVIDER_LABELS[provider_id],
            "currentAmount": round(current, 2),
            "runRateAmount": round(run_rate, 2),
            "previousAmount": round(previous, 2),
            "trendPct": trend_pct(run_rate, previous) if previous else None,
            "isEstimated": is_estimated,
            "sourceKind": source_kind,
            "warnings": (payload.get("source") or {}).get("warnings", []) if isinstance(payload.get("source"), dict) else ["Legacy provider JSON has no scraper provenance metadata."],
        })
    return records


def forecast_growth_rate(records: list[dict]) -> float:
    current = sum(r["runRateAmount"] for r in records)
    previous_values = [r["previousAmount"] for r in records if r["previousAmount"] > 0]
    previous = sum(previous_values)
    if current <= 0:
        return 0.0
    if previous <= 0:
        return 0.03
    pct = trend_pct(current, previous)
    if pct is None or math.isnan(pct):
        return 0.03
    return clamp(pct / 100, -0.2, 0.25)


def format_compact_usd(amount: float) -> str:
    if abs(amount) >= 1000:
        return f"${amount / 1000:,.1f}k"
    return fmt_usd(amount)


def risk_from_growth(rate: float, estimated_pct: float) -> str:
    if estimated_pct > 50 or rate >= 0.18:
        return "HIGH"
    if rate >= 0.08 or estimated_pct > 0:
        return "MEDIUM"
    return "LOW"


def build_cloud_forecast(provider_data: dict, months: int = 6, today: date | None = None) -> dict:
    today = today or date.today()
    records = provider_records(provider_data, today)
    generated_at = utc_now_iso()
    windows = forecast_month_windows(months, today)

    current_total = sum(r["runRateAmount"] for r in records)
    previous_total = sum(r["previousAmount"] for r in records if r["previousAmount"] > 0)
    estimated_total = sum(r["runRateAmount"] for r in records if r["isEstimated"])
    actual_total = max(0.0, current_total - estimated_total)
    estimated_pct = (estimated_total / current_total * 100) if current_total else 0.0
    actual_pct = (actual_total / current_total * 100) if current_total else 0.0
    rate = forecast_growth_rate(records)

    monthly_budget = []
    baseline = current_total
    for index, window in enumerate(windows):
        if index == 0:
            baseline = current_total
        else:
            baseline = baseline * (1 + rate)
        optimized = baseline * (0.88 if index > 0 else 0.94)
        monthly_budget.append({
            "month": window["key"],
            "label": window["label"],
            "cloud": round(baseline / 1000, 2),
            "baseline": round(baseline / 1000, 2),
            "optimized": round(optimized / 1000, 2),
            "runRate": round(current_total / 1000, 2),
            "isActual": bool(window["isCurrent"]),
            "estimatedPct": round(estimated_pct, 1),
        })

    service_spend = [
        {
            "label": record["label"],
            "value": round(record["runRateAmount"] / 1000, 2),
            "color": PROVIDER_COLORS[record["id"]],
            "isEstimated": record["isEstimated"],
            "sourceKind": record["sourceKind"],
        }
        for record in sorted(records, key=lambda item: item["runRateAmount"], reverse=True)
    ]

    chart = [
        {
            "label": item["label"],
            "baseline": item["baseline"],
            "optimized": item["optimized"],
            "runRate": item["runRate"],
        }
        for item in monthly_budget
    ]

    six_month_total = sum(item["baseline"] for item in monthly_budget) * 1000
    optimized_total = sum(item["optimized"] for item in monthly_budget) * 1000
    risk = risk_from_growth(rate, estimated_pct)
    warnings = sorted({
        warning
        for record in records
        for warning in record.get("warnings", [])
        if warning
    })
    if not records:
        warnings.append("No cloud provider data available. Run scraper.py with at least one cloud provider credential.")

    source_rows = [
        [
            record["label"],
            "Estimate" if record["isEstimated"] else "Actual",
            record["sourceKind"].replace("_", " "),
        ]
        for record in records
    ]

    scenarios = [
        {
            "id": "current-trend",
            "prompt": "Continue current cloud trend",
            "headline": f"Cloud spend trends at {rate * 100:+.0f}% month over month.",
            "summary": "Projection uses current cloud run-rate and the bounded month-over-month trend from available provider actuals.",
            "numbers": [
                ["Current run-rate", format_compact_usd(current_total)],
                ["Next month forecast", format_compact_usd(monthly_budget[1]["baseline"] * 1000 if len(monthly_budget) > 1 else current_total)],
                ["Six-month cloud total", format_compact_usd(six_month_total)],
                ["Estimated coverage", f"{estimated_pct:.0f}%"],
            ],
            "risk": risk,
            "keyRisk": "Forecast confidence is limited by providers marked estimated or missing actual billing access.",
            "recommendations": [
                "Add actual billing exports for every connected provider before relying on budget limits.",
                "Set a monthly cloud alert at the next-month forecast value.",
                "Review the largest provider line before approving usage growth.",
            ],
            "confidence": int(clamp(actual_pct, 35, 95)),
            "basedOn": [
                f"{len(records)} cloud provider(s) with cost data",
                f"{actual_pct:.0f}% of run-rate marked actual",
                f"{rate * 100:+.0f}% bounded monthly trend",
            ],
            "metrics": {
                "infraCost": format_compact_usd(current_total),
                "forecast": format_compact_usd(six_month_total),
                "savings": format_compact_usd(max(0, six_month_total - optimized_total)),
                "confidence": f"{actual_pct:.0f}% actual",
            },
            "chart": chart,
        },
        {
            "id": "optimization",
            "prompt": "Apply a 12% cloud optimization target",
            "headline": "A conservative optimization pass reduces the six-month cloud budget.",
            "summary": "Projection keeps current usage trend but applies a 12% reduction to forecast months after the current month.",
            "numbers": [
                ["Potential six-month savings", format_compact_usd(max(0, six_month_total - optimized_total))],
                ["Optimized monthly target", format_compact_usd(monthly_budget[-1]["optimized"] * 1000 if monthly_budget else 0)],
                ["Current run-rate", format_compact_usd(current_total)],
                ["Actual coverage", f"{actual_pct:.0f}%"],
            ],
            "risk": "MEDIUM" if estimated_pct else "LOW",
            "keyRisk": "Optimization targets are only dependable where provider costs are actual, not estimated.",
            "recommendations": [
                "Prioritize the largest provider in the cost mix.",
                "Create per-provider budgets from the optimized target line.",
                "Track actual invoices against the target at month close.",
            ],
            "confidence": int(clamp(actual_pct - 5, 30, 90)),
            "basedOn": [
                "12% reduction applied only to forecast months",
                f"{format_compact_usd(current_total)} current cloud run-rate",
                f"{estimated_pct:.0f}% estimated input coverage",
            ],
            "metrics": {
                "infraCost": format_compact_usd(current_total),
                "forecast": format_compact_usd(optimized_total),
                "savings": format_compact_usd(max(0, six_month_total - optimized_total)),
                "confidence": f"{actual_pct:.0f}% actual",
            },
            "chart": chart,
        },
        {
            "id": "usage-spike",
            "prompt": "What if cloud usage spikes 25%?",
            "headline": "A 25% usage spike materially raises the near-term cloud budget.",
            "summary": "Projection applies a one-time 25% step-up to the current cloud run-rate, then follows the same bounded trend.",
            "numbers": [
                ["Spike run-rate", format_compact_usd(current_total * 1.25)],
                ["Extra monthly cost", format_compact_usd(current_total * 0.25)],
                ["Six-month stress total", format_compact_usd(six_month_total * 1.25)],
                ["Estimated coverage", f"{estimated_pct:.0f}%"],
            ],
            "risk": "HIGH" if risk != "LOW" else "MEDIUM",
            "keyRisk": "A usage spike compounds quickly when the baseline trend is already positive.",
            "recommendations": [
                "Set provider budget alerts below the spike run-rate.",
                "Add usage caps to expensive managed services before launch events.",
                "Review forecast after the next closed billing month.",
            ],
            "confidence": int(clamp(actual_pct - 10, 25, 85)),
            "basedOn": [
                "25% one-time usage stress",
                f"{rate * 100:+.0f}% bounded monthly trend",
                f"{format_compact_usd(current_total)} current cloud run-rate",
            ],
            "metrics": {
                "infraCost": format_compact_usd(current_total * 1.25),
                "forecast": format_compact_usd(six_month_total * 1.25),
                "savings": "$0",
                "confidence": f"{actual_pct:.0f}% actual",
            },
            "chart": [
                {
                    "label": point["label"],
                    "baseline": round(point["baseline"] * 1.25, 2),
                    "optimized": point["optimized"],
                    "runRate": round(point["runRate"] * 1.25, 2),
                }
                for point in chart
            ],
        },
    ]

    return {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "currency": "USD",
        "horizonMonths": months,
        "summary": {
            "currentMonthlyCost": round(current_total, 2),
            "previousMonthlyCost": round(previous_total, 2),
            "trendPct": round(rate * 100, 2),
            "nextMonthForecast": round(monthly_budget[1]["baseline"] * 1000 if len(monthly_budget) > 1 else current_total, 2),
            "sixMonthForecastTotal": round(six_month_total, 2),
            "optimizedSixMonthTotal": round(optimized_total, 2),
            "actualCoveragePct": round(actual_pct, 1),
            "estimatedCoveragePct": round(estimated_pct, 1),
            "risk": risk,
        },
        "providers": records,
        "sourceRows": source_rows,
        "monthlyBudget": monthly_budget,
        "serviceSpend": service_spend,
        "chart": chart,
        "scenarios": scenarios,
        "warnings": warnings,
    }


FORECAST_OUT_FILE = os.path.join(ACCOUNT_DATA_DIR, "forecast.json")


def write_cloud_forecast(provider_data: dict) -> dict:
    forecast = build_cloud_forecast(provider_data)
    os.makedirs(ACCOUNT_DATA_DIR, exist_ok=True)
    with open(FORECAST_OUT_FILE, "w") as fh:
        json.dump(forecast, fh, indent=2)
    print(f"Wrote {FORECAST_OUT_FILE}", file=sys.stderr)
    return forecast


# ── entrypoint ────────────────────────────────────────────────────────────────

PROVIDERS: dict[str, tuple[str, callable]] = {
    "aws":        ("AWS_ACCESS_KEY_ID",       scrape_aws),
    "gcp":        ("GCP_PROJECT_ID",          scrape_gcp),
    "azure":      ("AZURE_SUBSCRIPTION_ID",   scrape_azure),
    "cloudflare": ("CLOUDFLARE_API_TOKEN",    scrape_cloudflare),
}

OUT_FILE = os.path.join(ACCOUNT_DATA_DIR, "providers.json")


def _consume_value_arg(prefix: str) -> str | None:
    """Pop `--flag=value` or `--flag value` from sys.argv and return value."""
    for index, token in enumerate(list(sys.argv)):
        if token == prefix and index + 1 < len(sys.argv):
            value = sys.argv[index + 1]
            del sys.argv[index : index + 2]
            return value
        if token.startswith(prefix + "="):
            value = token.split("=", 1)[1]
            del sys.argv[index]
            return value
    return None


def _bootstrap_gcp_api_key() -> None:
    inline = _consume_value_arg("--gcp-api-key")
    key_file = _consume_value_arg("--gcp-api-key-file")
    if inline:
        os.environ["GOOGLE_API_KEY"] = inline.strip()
        return
    if key_file:
        try:
            with open(os.path.expanduser(key_file)) as fh:
                for line in fh:
                    candidate = line.strip()
                    if candidate and not candidate.startswith("#"):
                        os.environ["GOOGLE_API_KEY"] = candidate
                        return
        except OSError as exc:
            print(f"  [warn] --gcp-api-key-file {key_file}: {exc}", file=sys.stderr)


def main() -> None:
    _bootstrap_gcp_api_key()
    if "--pricing-estimates" in sys.argv:
        config_path = PUBLIC_PRICING_INPUT_FILE
        if "--config" in sys.argv:
            try:
                config_path = sys.argv[sys.argv.index("--config") + 1]
            except IndexError:
                print("--config requires a file path", file=sys.stderr)
                sys.exit(2)
        run_public_pricing_estimates(config_path)
        return
    if "--pricing" in sys.argv:
        run_pricing()
        return
    if "--forecast" in sys.argv:
        with open(OUT_FILE) as fh:
            provider_data = json.load(fh)
        write_cloud_forecast(provider_data)
        return

    output: dict = {}
    failed: list[str] = []

    for name, (sentinel, fn) in PROVIDERS.items():
        if not os.environ.get(sentinel):
            print(f"[SKIP] {name.upper()}: {sentinel} not set", file=sys.stderr)
            continue

        print(f"[....] {name.upper()} ...", file=sys.stderr, end=" ", flush=True)
        try:
            output[name] = fn()
            print("OK", file=sys.stderr)
        except Exception as exc:
            print(f"FAILED — {exc}", file=sys.stderr)
            failed.append(name)

    if not output:
        print("No providers scraped. Set at least one provider's env vars.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(ACCOUNT_DATA_DIR, exist_ok=True)
    with open(OUT_FILE, "w") as fh:
        json.dump(output, fh, indent=2)

    print(f"\nWrote {OUT_FILE}  ({len(output)} provider(s))", file=sys.stderr)
    write_cloud_forecast(output)
    if failed:
        print(f"Failed: {', '.join(failed)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
