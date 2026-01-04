# SERAPH

**S**ecurity **E**vent **R**esponse & **A**utonomous **P**rotection **H**andler

Security Lake Dashboard for monitoring and querying AWS Security Lake data.

## Features

- **Security Lake Status** - Real-time view of Security Lake configuration
- **Data Source Monitoring** - Track CloudTrail, Security Hub, and other sources
- **Pre-built Queries** - Ready-to-run Athena queries for common investigations
- **Query Results** - View query results directly in the dashboard

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SERAPH Dashboard                          │
│              (React + Vite + Tailwind)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              CloudFront Distribution                         │
│    ┌──────────────────┐    ┌──────────────────────────┐    │
│    │   S3 (Static)    │    │   API Gateway → Lambda   │    │
│    │   /index.html    │    │   /api/securitylake/*    │    │
│    └──────────────────┘    └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
            ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
            │  Security   │      │    Glue     │      │   Athena    │
            │    Lake     │      │   Catalog   │      │   Queries   │
            │    API      │      │             │      │             │
            └─────────────┘      └─────────────┘      └─────────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │   Security Lake     │
                              │   S3 Data (OCSF)    │
                              └─────────────────────┘
```

## Prerequisites

- Python 3.11+
- Node.js 18+ (for frontend)
- AWS CLI configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- [uv](https://github.com/astral-sh/uv) package manager
- **Security Lake already enabled** in your AWS account

## Deployment

### Step 1: Enable Security Lake (if not already done)

Security Lake must be enabled via Console first:

```
AWS Console → Security Lake → Get started
- Select: CloudTrail + Security Hub
- Retention: 7 days for dev, longer for production
- Click Create
```

Verify:
```bash
aws securitylake list-data-lakes --regions us-east-1
```

### Step 2: Install Dependencies

```bash
git clone https://github.com/your-org/seraph.git
cd seraph
uv venv && source .venv/bin/activate
uv pip install -e ".[dev,cdk]"

# Frontend
cd frontend && npm install && cd ..
```

### Step 3: Deploy Infrastructure (CDK)

```bash
cd infrastructure
cdk bootstrap  # First time only
cdk deploy seraph-web
```

### Step 4: Grant Lake Formation Permissions (CRITICAL)

> **This step is required!** Security Lake uses AWS Lake Formation for access control.
> The Lambda function needs Lake Formation permissions to query the data.

Get the Lambda role ARN from the CDK output, then run:

```bash
# Replace <LAMBDA_ROLE_ARN> with the actual ARN from CDK output
# Example: arn:aws:iam::123456789012:role/seraph-web-APIFunctionServiceRole...

# Grant database access
aws lakeformation grant-permissions \
  --principal DataLakePrincipalIdentifier="<LAMBDA_ROLE_ARN>" \
  --resource '{"Database":{"Name":"amazon_security_lake_glue_db_us_east_1"}}' \
  --permissions DESCRIBE \
  --region us-east-1

# Grant table access (SELECT for querying)
aws lakeformation grant-permissions \
  --principal DataLakePrincipalIdentifier="<LAMBDA_ROLE_ARN>" \
  --resource '{"Table":{"DatabaseName":"amazon_security_lake_glue_db_us_east_1","TableWildcard":{}}}' \
  --permissions SELECT DESCRIBE \
  --region us-east-1
```

**Why is this needed?**
- Security Lake databases are protected by AWS Lake Formation
- IAM permissions alone are NOT sufficient
- Lake Formation permissions must be granted by a Lake Formation administrator
- This cannot be automated via CloudFormation unless the deploying role is a Lake Formation admin

### Step 5: Deploy Frontend

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://<BUCKET_NAME> --delete
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

The bucket name and distribution ID are in the CDK outputs.

### Step 6: Verify

Open the CloudFront URL from CDK outputs. You should see:
- Security Lake status (enabled, region, retention)
- Data sources (CloudTrail, Security Hub)
- Glue tables
- Query runner with pre-built queries

## Project Structure

```
seraph/
├── frontend/                 # React dashboard
│   └── src/
│       ├── components/       # SecurityLakeStatus, QueryRunner
│       ├── pages/            # Dashboard
│       ├── api/              # API client
│       └── types/            # TypeScript types
├── infrastructure/
│   ├── app.py                # CDK entry point
│   └── stacks/
│       └── web_stack.py      # S3, CloudFront, API Gateway, Lambda
├── lambdas/
│   └── api/
│       ├── handler.py        # API endpoints
│       └── queries.py        # Pre-canned Athena queries
└── pyproject.toml
```

## Available Queries

| Query | Description |
|-------|-------------|
| CloudTrail Event Count | Events per day (last 7 days) |
| Unauthorized Attempts | Access denied errors |
| IAM Activity | All IAM API calls |
| Failed Records | Failed CloudTrail operations |
| Security Hub Findings | Medium+ severity findings |
| Data Freshness | Most recent event per source |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty tables list | Grant Lake Formation permissions (Step 4) |
| Query fails with "Insufficient permissions" | Grant Lake Formation permissions (Step 4) |
| "lakeformation:GetDataAccess" error | Add `lakeformation:GetDataAccess` IAM permission |
| API returns 500 | Check Lambda CloudWatch logs |
| No data in queries | Verify Security Lake has data flowing |

## CI/CD with GitHub Actions

The repo includes a GitHub Actions workflow for automated deployments.

### Setup

1. **Create an IAM OIDC Provider** for GitHub Actions:
   ```bash
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com \
     --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
   ```

2. **Create an IAM Role** for GitHub Actions with this trust policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:BLANXLAIT/SERAPH:*"
           }
         }
       }
     ]
   }
   ```

3. **Attach policies** to the role:
   - `AdministratorAccess` (for CDK deployments), or scoped policies for:
     - CloudFormation, S3, CloudFront, Lambda, API Gateway, IAM, Glue, Athena

4. **Add GitHub Secrets** (Settings → Secrets → Actions):
   | Secret | Description |
   |--------|-------------|
   | `AWS_ROLE_ARN` | ARN of the IAM role created above |
   | `S3_BUCKET_NAME` | From CDK output `BucketName` |
   | `CLOUDFRONT_DISTRIBUTION_ID` | From CDK output (extract from URL) |

### Workflows

- **Push to main**: Automatically deploys frontend to S3 + invalidates CloudFront
- **Manual trigger**: Can optionally deploy CDK infrastructure

> **Note:** Lake Formation permissions must still be granted manually after infrastructure deployment.

## Development

```bash
# Run frontend locally
cd frontend && npm run dev

# Run tests
python -m pytest tests/ -v

# Lint
ruff check .
cd frontend && npm run lint
```

## License

MIT
