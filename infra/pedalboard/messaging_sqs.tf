# SQS Queue for audio processing jobs
resource "aws_sqs_queue" "jobs" {
  name                       = local.sqs_queue_name
  visibility_timeout_seconds = var.sqs_visibility_timeout
  message_retention_seconds  = var.sqs_message_retention
  receive_wait_time_seconds  = 20 # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.jobs_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = local.sqs_queue_name
    Environment = local.environment
    Project     = local.project_name
  }
}

# Dead Letter Queue
resource "aws_sqs_queue" "jobs_dlq" {
  name                      = "${local.sqs_queue_name}-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name        = "${local.sqs_queue_name}-dlq"
    Environment = local.environment
    Project     = local.project_name
  }
}

# SQS Queue Policy (allow Lambda to send messages)
resource "aws_sqs_queue_policy" "jobs" {
  queue_url = aws_sqs_queue.jobs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaSendMessage"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.lambda.arn
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.jobs.arn
      }
    ]
  })
}
