"""Web infrastructure stack for SERAPH Security Lake Dashboard."""

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    BundlingOptions,
    Aws,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_apigateway as apigw,
    aws_lambda as lambda_,
    aws_iam as iam,
)
from constructs import Construct


def create_python_bundling() -> BundlingOptions:
    """Create bundling options for Python Lambda with pip dependencies."""
    return BundlingOptions(
        image=lambda_.Runtime.PYTHON_3_11.bundling_image,
        platform="linux/amd64",
        command=[
            "bash", "-c",
            "pip install -r requirements.txt -t /asset-output && cp -rT . /asset-output",
        ],
    )


class WebStack(Stack):
    """
    Web infrastructure for SERAPH Security Lake Dashboard.

    Creates:
    - S3 bucket for static website hosting
    - CloudFront distribution
    - API Gateway REST API
    - Lambda function for Security Lake queries
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # S3 bucket for static website hosting (private, accessed via CloudFront)
        self.website_bucket = s3.Bucket(
            self,
            "WebsiteBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # S3 bucket for Athena query results
        self.athena_results_bucket = s3.Bucket(
            self,
            "AthenaResultsBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            lifecycle_rules=[
                s3.LifecycleRule(
                    expiration=Duration.days(1),
                    id="ExpireQueryResults",
                ),
            ],
        )

        # API Lambda function
        self.api_fn = lambda_.Function(
            self,
            "APIFunction",
            runtime=lambda_.Runtime.PYTHON_3_11,
            handler="handler.lambda_handler",
            code=lambda_.Code.from_asset(
                "../lambdas/api",
                bundling=create_python_bundling(),
            ),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "ATHENA_OUTPUT_BUCKET": self.athena_results_bucket.bucket_name,
                "LOG_LEVEL": "INFO",
            },
        )

        # Grant Athena results bucket access
        self.athena_results_bucket.grant_read_write(self.api_fn)

        # Security Lake API permissions
        self.api_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "securitylake:ListDataLakes",
                    "securitylake:ListLogSources",
                    "securitylake:GetDataLakeSource",
                ],
                resources=["*"],
            )
        )

        # Athena query execution permissions
        self.api_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "athena:StartQueryExecution",
                    "athena:GetQueryExecution",
                    "athena:GetQueryResults",
                    "athena:StopQueryExecution",
                ],
                resources=[
                    f"arn:aws:athena:{Aws.REGION}:{Aws.ACCOUNT_ID}:workgroup/*",
                ],
            )
        )

        # Glue catalog access for Athena queries
        self.api_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "glue:GetDatabase",
                    "glue:GetTable",
                    "glue:GetTables",
                    "glue:GetPartitions",
                ],
                resources=[
                    f"arn:aws:glue:{Aws.REGION}:{Aws.ACCOUNT_ID}:catalog",
                    f"arn:aws:glue:{Aws.REGION}:{Aws.ACCOUNT_ID}:database/amazon_security_lake_*",
                    f"arn:aws:glue:{Aws.REGION}:{Aws.ACCOUNT_ID}:table/amazon_security_lake_*/*",
                ],
            )
        )

        # Lake Formation data access (required to query Lake Formation protected tables)
        self.api_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=["lakeformation:GetDataAccess"],
                resources=["*"],
            )
        )

        # S3 access for Security Lake data (read-only)
        self.api_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "s3:GetObject",
                    "s3:ListBucket",
                ],
                resources=[
                    "arn:aws:s3:::aws-security-data-lake-*",
                    "arn:aws:s3:::aws-security-data-lake-*/*",
                ],
            )
        )

        # NOTE: Lake Formation permissions are granted manually via CLI because
        # Security Lake databases require special permissions to grant access.
        # Run these commands after deployment:
        #   aws lakeformation grant-permissions \
        #     --principal DataLakePrincipalIdentifier=<LAMBDA_ROLE_ARN> \
        #     --resource '{"Database":{"Name":"amazon_security_lake_glue_db_us_east_1"}}' \
        #     --permissions DESCRIBE
        #   aws lakeformation grant-permissions \
        #     --principal DataLakePrincipalIdentifier=<LAMBDA_ROLE_ARN> \
        #     --resource '{"Table":{"DatabaseName":"amazon_security_lake_glue_db_us_east_1","TableWildcard":{}}}' \
        #     --permissions SELECT DESCRIBE

        # API Gateway REST API
        self.api = apigw.RestApi(
            self,
            "SeraphAPI",
            rest_api_name="SERAPH Security Lake API",
            description="REST API for SERAPH Security Lake Dashboard",
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=["Content-Type", "Authorization"],
            ),
        )

        # Lambda integration
        api_integration = apigw.LambdaIntegration(
            self.api_fn,
            proxy=True,
        )

        # API routes: /api/securitylake/*
        api_resource = self.api.root.add_resource("api")
        securitylake_resource = api_resource.add_resource("securitylake")

        # /api/securitylake/status
        sl_status_resource = securitylake_resource.add_resource("status")
        sl_status_resource.add_method("GET", api_integration)

        # /api/securitylake/sources
        sl_sources_resource = securitylake_resource.add_resource("sources")
        sl_sources_resource.add_method("GET", api_integration)

        # /api/securitylake/tables
        sl_tables_resource = securitylake_resource.add_resource("tables")
        sl_tables_resource.add_method("GET", api_integration)

        # /api/securitylake/queries
        sl_queries_resource = securitylake_resource.add_resource("queries")
        sl_queries_resource.add_method("GET", api_integration)

        # /api/securitylake/query
        sl_query_resource = securitylake_resource.add_resource("query")
        sl_query_resource.add_method("POST", api_integration)

        # CloudFront Origin Access Control for S3
        oac = cloudfront.S3OriginAccessControl(
            self,
            "WebsiteOAC",
            description="OAC for SERAPH Dashboard S3 bucket",
        )

        # CloudFront distribution
        self.distribution = cloudfront.Distribution(
            self,
            "WebsiteDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(
                    self.website_bucket,
                    origin_access_control=oac,
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ),
            additional_behaviors={
                "/api/*": cloudfront.BehaviorOptions(
                    origin=origins.RestApiOrigin(self.api),
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                    cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,
                    origin_request_policy=cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                ),
            },
            default_root_object="index.html",
            error_responses=[
                # SPA routing: return index.html for 404s
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                    ttl=Duration.seconds(0),
                ),
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                    ttl=Duration.seconds(0),
                ),
            ],
        )

        # Outputs
        CfnOutput(
            self,
            "WebsiteURL",
            value=f"https://{self.distribution.domain_name}",
            description="CloudFront URL for SERAPH Dashboard",
        )
        CfnOutput(
            self,
            "APIEndpoint",
            value=self.api.url,
            description="API Gateway endpoint URL",
        )
        CfnOutput(
            self,
            "BucketName",
            value=self.website_bucket.bucket_name,
            description="S3 bucket for static website files",
        )
