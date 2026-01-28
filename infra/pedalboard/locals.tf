locals {
  project_name = "pedalboard-demo"
  environment  = var.environment

  name_prefix = "${local.project_name}-${local.environment}"

  # S3
  frontend_bucket_name = "${local.name_prefix}-frontend"
  audio_bucket_name    = "${local.name_prefix}-audio"

  # Lambda
  lambda_function_name = "${local.name_prefix}-processor"

  # ECR
  ecr_repository_name = "${local.project_name}/lambda"
}
