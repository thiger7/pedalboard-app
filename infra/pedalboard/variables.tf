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
