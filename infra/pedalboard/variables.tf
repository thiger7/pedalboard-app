variable "aws_profile" {
  description = "AWS profile name"
  type        = string
}

variable "environment" {
  description = "Environment name (prod, stg, etc.)"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

# API Gateway
variable "api_throttle_rate_limit" {
  description = "API Gateway throttle rate limit (requests per second)"
  type        = number
  default     = 100
}

variable "api_throttle_burst_limit" {
  description = "API Gateway throttle burst limit"
  type        = number
  default     = 50
}

# Lambda
variable "lambda_memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 256
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

# DynamoDB
variable "job_ttl_days" {
  description = "Job TTL in days (how long to keep job records)"
  type        = number
  default     = 7
}

# SQS
variable "sqs_visibility_timeout" {
  description = "SQS visibility timeout in seconds (should be >= Lambda timeout)"
  type        = number
  default     = 120
}

variable "sqs_message_retention" {
  description = "SQS message retention in seconds (default 4 days)"
  type        = number
  default     = 345600
}

# Domain
variable "domain_name" {
  description = "Root domain name"
  type        = string
}

variable "subdomain" {
  description = "Subdomain for this app (e.g. pedalboard)"
  type        = string
  default     = "pedalboard"
}
