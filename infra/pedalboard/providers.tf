terraform {
  required_version = "1.14.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.27.0"
    }
  }
}

provider "aws" {
  region  = "ap-northeast-1"
  profile = var.aws_profile

  default_tags {
    tags = {
      project   = local.project_name
      env       = local.environment
      service   = "pedalboard"
      ManagedBy = "Terraform"
    }
  }
}
