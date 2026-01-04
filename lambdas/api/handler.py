"""Lambda handler for SERAPH Security Lake Dashboard API."""

import json
import os
import time
from typing import Any

import boto3
import structlog
from queries import get_query, list_queries

logger = structlog.get_logger()

# AWS clients
securitylake = boto3.client("securitylake")
athena = boto3.client("athena")
glue = boto3.client("glue")

# Configuration
ATHENA_OUTPUT_BUCKET = os.environ.get("ATHENA_OUTPUT_BUCKET", "seraph-athena-results")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")


def cors_response(status_code: int, body: Any) -> dict[str, Any]:
    """Create CORS-enabled API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


def get_security_lake_status(event: dict[str, Any]) -> dict[str, Any]:
    """Get Security Lake status and configuration."""
    logger.info("get_security_lake_status")

    try:
        # Get data lake configuration
        response = securitylake.list_data_lakes(regions=[AWS_REGION])
        data_lakes = response.get("dataLakes", [])

        if not data_lakes:
            return cors_response(200, {
                "enabled": False,
                "message": "Security Lake not configured in this region",
            })

        lake = data_lakes[0]
        lifecycle = lake.get("lifecycleConfiguration", {})
        expiration = lifecycle.get("expiration", {})

        return cors_response(200, {
            "enabled": True,
            "createStatus": lake.get("createStatus"),
            "region": lake.get("region"),
            "retentionDays": expiration.get("days"),
            "s3BucketArn": lake.get("s3BucketArn"),
            "encryptionType": lake.get("encryptionConfiguration", {}).get(
                "kmsKeyId", "S3_MANAGED_KEY"
            ),
        })

    except Exception as e:
        logger.error("get_security_lake_status_error", error=str(e))
        return cors_response(500, {"error": str(e)})


def get_security_lake_sources(event: dict[str, Any]) -> dict[str, Any]:
    """Get configured log sources for Security Lake."""
    logger.info("get_security_lake_sources")

    try:
        response = securitylake.list_log_sources(regions=[AWS_REGION])
        sources = response.get("sources", [])

        # Flatten the nested structure
        result = []
        for account_sources in sources:
            account_id = account_sources.get("account")
            region = account_sources.get("region")
            for source in account_sources.get("sources", []):
                aws_source = source.get("awsLogSource", {})
                if aws_source:
                    result.append({
                        "accountId": account_id,
                        "region": region,
                        "sourceName": aws_source.get("sourceName"),
                        "sourceVersion": aws_source.get("sourceVersion"),
                    })

        return cors_response(200, {"sources": result})

    except Exception as e:
        logger.error("get_security_lake_sources_error", error=str(e))
        return cors_response(500, {"error": str(e)})


def get_security_lake_tables(event: dict[str, Any]) -> dict[str, Any]:
    """Get Glue tables for Security Lake database."""
    logger.info("get_security_lake_tables")

    try:
        database_name = f"amazon_security_lake_glue_db_{AWS_REGION.replace('-', '_')}"
        response = glue.get_tables(DatabaseName=database_name)
        tables = response.get("TableList", [])

        result = []
        for table in tables:
            create_time = table.get("CreateTime")
            update_time = table.get("UpdateTime")
            result.append({
                "name": table.get("Name"),
                "createTime": create_time.isoformat() if create_time else None,
                "updateTime": update_time.isoformat() if update_time else None,
                "tableType": table.get("TableType"),
            })

        return cors_response(200, {
            "database": database_name,
            "tables": result,
        })

    except glue.exceptions.EntityNotFoundException:
        return cors_response(200, {
            "database": None,
            "tables": [],
            "message": "Security Lake Glue database not found",
        })
    except Exception as e:
        logger.error("get_security_lake_tables_error", error=str(e))
        return cors_response(500, {"error": str(e)})


def get_available_queries(event: dict[str, Any]) -> dict[str, Any]:
    """Get list of available pre-canned queries."""
    logger.info("get_available_queries")
    return cors_response(200, {"queries": list_queries()})


def run_query(event: dict[str, Any]) -> dict[str, Any]:
    """Execute a pre-canned Athena query."""
    logger.info("run_query")

    try:
        # Parse request body
        body = json.loads(event.get("body", "{}"))
        query_id = body.get("queryId")

        if not query_id:
            return cors_response(400, {"error": "queryId is required"})

        query = get_query(query_id)
        if not query:
            return cors_response(404, {"error": f"Query '{query_id}' not found"})

        # Start Athena query execution
        database_name = f"amazon_security_lake_glue_db_{AWS_REGION.replace('-', '_')}"
        output_location = f"s3://{ATHENA_OUTPUT_BUCKET}/query-results/"

        start_response = athena.start_query_execution(
            QueryString=query["sql"],
            QueryExecutionContext={"Database": database_name},
            ResultConfiguration={"OutputLocation": output_location},
        )

        execution_id = start_response["QueryExecutionId"]
        logger.info("athena_query_started", execution_id=execution_id, query_id=query_id)

        # Poll for completion (with timeout)
        max_wait_seconds = 30
        poll_interval = 1
        elapsed = 0

        while elapsed < max_wait_seconds:
            status_response = athena.get_query_execution(QueryExecutionId=execution_id)
            status = status_response["QueryExecution"]["Status"]["State"]

            if status == "SUCCEEDED":
                # Get results
                results_response = athena.get_query_results(
                    QueryExecutionId=execution_id,
                    MaxResults=100,
                )

                # Parse results
                columns = []
                rows = []
                result_set = results_response.get("ResultSet", {})

                if result_set.get("ResultSetMetadata", {}).get("ColumnInfo"):
                    columns = [
                        col["Name"]
                        for col in result_set["ResultSetMetadata"]["ColumnInfo"]
                    ]

                for i, row in enumerate(result_set.get("Rows", [])):
                    if i == 0:  # Skip header row
                        continue
                    row_data = {}
                    for j, col in enumerate(columns):
                        data = row.get("Data", [])
                        cell = data[j] if j < len(data) else {}
                        row_data[col] = cell.get("VarCharValue")
                    rows.append(row_data)

                # Get execution stats
                stats = status_response["QueryExecution"].get("Statistics", {})

                return cors_response(200, {
                    "queryId": query_id,
                    "executionId": execution_id,
                    "status": "succeeded",
                    "columns": columns,
                    "rows": rows,
                    "rowCount": len(rows),
                    "executionTimeMs": stats.get("TotalExecutionTimeInMillis"),
                    "dataScannedBytes": stats.get("DataScannedInBytes"),
                })

            elif status in ["FAILED", "CANCELLED"]:
                query_status = status_response["QueryExecution"]["Status"]
                reason = query_status.get("StateChangeReason", "Unknown error")
                return cors_response(200, {
                    "queryId": query_id,
                    "executionId": execution_id,
                    "status": status.lower(),
                    "error": reason,
                })

            time.sleep(poll_interval)
            elapsed += poll_interval

        # Timeout - return execution ID for async polling
        return cors_response(200, {
            "queryId": query_id,
            "executionId": execution_id,
            "status": "running",
            "message": "Query still running. Use executionId to check status.",
        })

    except json.JSONDecodeError:
        return cors_response(400, {"error": "Invalid JSON body"})
    except Exception as e:
        logger.error("run_query_error", error=str(e))
        return cors_response(500, {"error": str(e)})


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Route API requests to appropriate handlers."""
    http_method = event.get("httpMethod", "")
    path = event.get("path", "")

    logger.info("api_request", method=http_method, path=path)

    # Handle CORS preflight
    if http_method == "OPTIONS":
        return cors_response(200, {})

    # Security Lake endpoints
    if path == "/api/securitylake/status" and http_method == "GET":
        return get_security_lake_status(event)
    elif path == "/api/securitylake/sources" and http_method == "GET":
        return get_security_lake_sources(event)
    elif path == "/api/securitylake/tables" and http_method == "GET":
        return get_security_lake_tables(event)
    elif path == "/api/securitylake/queries" and http_method == "GET":
        return get_available_queries(event)
    elif path == "/api/securitylake/query" and http_method == "POST":
        return run_query(event)

    else:
        return cors_response(404, {"error": "Not found", "path": path})
