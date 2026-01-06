#!/usr/bin/env python3
"""AWS CDK App entry point for SERAPH Security Lake Dashboard."""

import os

import aws_cdk as cdk
from stacks.web_stack import WebStack

app = cdk.App()

# Environment configuration
env = cdk.Environment(
    account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
    region=os.environ.get("CDK_DEFAULT_REGION", "us-east-1"),
)

# Stack configuration from context
stack_prefix = app.node.try_get_context("stack_prefix") or "seraph"

# Web dashboard stack (queries existing Security Lake)
web_stack = WebStack(
    app,
    f"{stack_prefix}-web",
    env=env,
    description="SERAPH Security Lake Dashboard (S3, CloudFront, API Gateway)",
)

# Add tags
cdk.Tags.of(web_stack).add("Project", "SERAPH")
cdk.Tags.of(web_stack).add("ManagedBy", "CDK")

app.synth()
