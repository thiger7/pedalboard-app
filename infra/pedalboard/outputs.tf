output "cloudfront_distribution_domain" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "api_gateway_url" {
  description = "API Gateway invoke URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "frontend_bucket_name" {
  description = "Frontend S3 bucket name"
  value       = aws_s3_bucket.frontend.id
}

output "audio_bucket_name" {
  description = "Audio S3 bucket name"
  value       = aws_s3_bucket.audio.id
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.lambda.repository_url
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.processor.function_name
}

output "dynamodb_table_name" {
  description = "DynamoDB jobs table name"
  value       = aws_dynamodb_table.jobs.name
}

output "dynamodb_table_arn" {
  description = "DynamoDB jobs table ARN"
  value       = aws_dynamodb_table.jobs.arn
}

output "sqs_queue_url" {
  description = "SQS jobs queue URL"
  value       = aws_sqs_queue.jobs.url
}

output "sqs_queue_arn" {
  description = "SQS jobs queue ARN"
  value       = aws_sqs_queue.jobs.arn
}

output "worker_lambda_function_name" {
  description = "Worker Lambda function name"
  value       = aws_lambda_function.worker.function_name
}
