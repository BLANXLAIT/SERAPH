"""Pre-canned Athena queries for Security Lake verification.

Queries from AWS Security Lake documentation (OCSF 1.1.0 / Source Version 2)
References:
- https://docs.aws.amazon.com/security-lake/latest/userguide/subscriber-query-examples2.html
- https://docs.aws.amazon.com/security-lake/latest/userguide/cloudtrail-query-examples-sourceversion2.html
- https://docs.aws.amazon.com/security-lake/latest/userguide/security-hub-query-examples-sourceversion2.html
"""

import os

# Database and table configuration
# For cross-account deployments, set SECURITY_LAKE_DATABASE to the resource link database name
DATABASE = os.environ.get("SECURITY_LAKE_DATABASE", "amazon_security_lake_glue_db_us_east_1")
CLOUDTRAIL_TABLE = "amazon_security_lake_table_us_east_1_cloud_trail_mgmt_2_0"
SECURITYHUB_TABLE = "amazon_security_lake_table_us_east_1_sh_findings_2_0"

QUERIES = {
    # Health Check: Verify data is flowing
    "cloudtrail-event-count": {
        "name": "CloudTrail Event Count by Day",
        "description": "Verify CloudTrail data is flowing - shows event counts per day",
        "sql": f"""
SELECT
    DATE(time_dt) as event_date,
    COUNT(*) as event_count
FROM "{DATABASE}"."{CLOUDTRAIL_TABLE}"
WHERE time_dt BETWEEN CURRENT_TIMESTAMP - INTERVAL '7' DAY AND CURRENT_TIMESTAMP
GROUP BY DATE(time_dt)
ORDER BY event_date DESC
        """.strip(),
    },
    # From cloudtrail-query-examples-sourceversion2.html
    "unauthorized-attempts": {
        "name": "Unauthorized Attempts (7 days)",
        "description": "Access denied and unauthorized operation errors",
        "sql": f"""
SELECT
    time_dt,
    api.service.name as service,
    api.operation,
    api.response.error as error,
    api.response.message as message,
    cloud.region,
    actor.user.uid as user_id,
    src_endpoint.ip as source_ip,
    http_request.user_agent
FROM "{DATABASE}"."{CLOUDTRAIL_TABLE}"
WHERE time_dt BETWEEN CURRENT_TIMESTAMP - INTERVAL '7' DAY AND CURRENT_TIMESTAMP
AND api.response.error IN (
    'Client.UnauthorizedOperation',
    'Client.InvalidPermission.NotFound',
    'Client.OperationNotPermitted',
    'AccessDenied')
ORDER BY time_dt DESC
LIMIT 25
        """.strip(),
    },
    # From cloudtrail-query-examples-sourceversion2.html
    "iam-activity": {
        "name": "IAM Activity (7 days)",
        "description": "All IAM service API calls",
        "sql": f"""
SELECT
    time_dt,
    api.operation,
    actor.user.uid as user_id,
    src_endpoint.ip as source_ip,
    cloud.region,
    status
FROM "{DATABASE}"."{CLOUDTRAIL_TABLE}"
WHERE time_dt BETWEEN CURRENT_TIMESTAMP - INTERVAL '7' DAY AND CURRENT_TIMESTAMP
AND api.service.name = 'iam.amazonaws.com'
ORDER BY time_dt DESC
LIMIT 25
        """.strip(),
    },
    # From cloudtrail-query-examples-sourceversion2.html
    "failed-records": {
        "name": "Failed CloudTrail Records (7 days)",
        "description": "Operations that failed",
        "sql": f"""
SELECT
    time_dt,
    api.service.name as service,
    api.operation,
    actor.user.uid as user_id,
    actor.user.account.uid as account_id,
    cloud.region,
    api.response.error as error
FROM "{DATABASE}"."{CLOUDTRAIL_TABLE}"
WHERE status = 'Failure'
AND time_dt BETWEEN CURRENT_TIMESTAMP - INTERVAL '7' DAY AND CURRENT_TIMESTAMP
ORDER BY time_dt DESC
LIMIT 25
        """.strip(),
    },
    # From security-hub-query-examples-sourceversion2.html
    "sh-medium-severity": {
        "name": "Security Hub Findings >= Medium (7 days)",
        "description": "New findings with severity Medium or higher",
        "sql": f"""
SELECT
    time_dt,
    finding_info.title,
    severity,
    severity_id,
    status
FROM "{DATABASE}"."{SECURITYHUB_TABLE}"
WHERE time_dt BETWEEN CURRENT_TIMESTAMP - INTERVAL '7' DAY AND CURRENT_TIMESTAMP
    AND severity_id >= 3
    AND status = 'New'
ORDER BY time_dt DESC
LIMIT 25
        """.strip(),
    },
    # From security-hub-query-examples-sourceversion2.html
    "sh-products-count": {
        "name": "Security Hub Products Sending Findings",
        "description": "Count of findings by product source",
        "sql": f"""
SELECT
    metadata.product.name as product_name,
    COUNT(*) as finding_count
FROM "{DATABASE}"."{SECURITYHUB_TABLE}"
WHERE time_dt BETWEEN CURRENT_TIMESTAMP - INTERVAL '7' DAY AND CURRENT_TIMESTAMP
GROUP BY metadata.product.name
ORDER BY finding_count DESC
LIMIT 25
        """.strip(),
    },
    # Data freshness check
    "data-freshness": {
        "name": "Data Freshness Check",
        "description": "Most recent event timestamp per source",
        "sql": f"""
SELECT 'CloudTrail' as source, MAX(time_dt) as latest_event
FROM "{DATABASE}"."{CLOUDTRAIL_TABLE}"
WHERE time_dt BETWEEN CURRENT_TIMESTAMP - INTERVAL '1' DAY AND CURRENT_TIMESTAMP
UNION ALL
SELECT 'Security Hub' as source, MAX(time_dt) as latest_event
FROM "{DATABASE}"."{SECURITYHUB_TABLE}"
WHERE time_dt BETWEEN CURRENT_TIMESTAMP - INTERVAL '1' DAY AND CURRENT_TIMESTAMP
        """.strip(),
    },
}


def get_query(query_id: str) -> dict | None:
    """Get a query by ID."""
    return QUERIES.get(query_id)


def list_queries() -> list[dict]:
    """List all available queries with metadata."""
    return [
        {
            "id": query_id,
            "name": query["name"],
            "description": query["description"],
        }
        for query_id, query in QUERIES.items()
    ]
