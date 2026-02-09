# Infrastructure & Deployment

## Architecture

- **Frontend**: S3 + CloudFront
- **Backend**: Lambda (Container Image) + API Gateway
- **Storage**: S3 (audio files)
- **Database**: DynamoDB (job management)
- **Messaging**: SQS (async job queue) + DLQ

## Prerequisites

- AWS CLI configured
- Docker
- Terraform 1.14.x
- bun (for frontend build)
- direnv (for environment variables)

## Setup

1. Copy `.envrc.example` to `.envrc` and set your values:
   ```bash
   cp .envrc.example .envrc
   # Edit .envrc with your AWS account details
   direnv allow
   ```

## Deployment

### Using Deploy Script (Recommended)

```bash
# 全てデプロイ (Backend + Frontend)
./scripts/deploy.sh all

# バックエンドのみ
./scripts/deploy.sh backend

# フロントエンドのみ
./scripts/deploy.sh frontend
```

※ direnv が自動で読み込まれない場合:
```bash
direnv exec . ./scripts/deploy.sh all
```

### Manual Deployment

<details>
<summary>手動でデプロイする場合</summary>

#### Backend (Lambda)

```bash
# 1. ECR にログイン
aws ecr get-login-password --region ap-northeast-1 --profile $AWS_PROFILE | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com

# 2. Docker イメージをビルド (arm64 / lambda ターゲット)
cd backend
docker build --platform linux/arm64 --target lambda \
  -t $AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/pedalboard-demo/lambda:latest .

# 3. ECR にプッシュ
docker push $AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/pedalboard-demo/lambda:latest

# 4. Lambda 関数を更新
aws lambda update-function-code \
  --function-name pedalboard-demo-prod-processor \
  --image-uri $AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/pedalboard-demo/lambda:latest \
  --region ap-northeast-1 \
  --profile $AWS_PROFILE

# 5. 更新完了を待機
aws lambda wait function-updated \
  --function-name pedalboard-demo-prod-processor \
  --region ap-northeast-1 \
  --profile $AWS_PROFILE
```

#### Frontend

```bash
# 1. ビルド
cd client
bun run build

# 2. S3 にアップロード
aws s3 sync dist s3://pedalboard-demo-prod-frontend --delete \
  --profile $AWS_PROFILE --region ap-northeast-1

# 3. CloudFront キャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*" \
  --profile $AWS_PROFILE
```

#### Full Deployment (Backend + Frontend)

```bash
# Backend
aws ecr get-login-password --region ap-northeast-1 --profile $AWS_PROFILE | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com && \
cd backend && \
docker build --platform linux/arm64 --target lambda \
  -t $AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/pedalboard-demo/lambda:latest . && \
docker push $AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/pedalboard-demo/lambda:latest && \
aws lambda update-function-code \
  --function-name pedalboard-demo-prod-processor \
  --image-uri $AWS_ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/pedalboard-demo/lambda:latest \
  --region ap-northeast-1 \
  --profile $AWS_PROFILE && \
aws lambda wait function-updated \
  --function-name pedalboard-demo-prod-processor \
  --region ap-northeast-1 \
  --profile $AWS_PROFILE

# Frontend
cd ../client && \
bun run build && \
aws s3 sync dist s3://pedalboard-demo-prod-frontend --delete \
  --profile $AWS_PROFILE --region ap-northeast-1 && \
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*" \
  --profile $AWS_PROFILE
```

</details>

## Infrastructure Management (Terraform)

```bash
cd infra/pedalboard

# 初期化
terraform init -backend-config=env/prod/s3.tfbackend

# 差分確認
terraform plan -var-file=env/prod/inputs.tfvars

# 適用
terraform apply -var-file=env/prod/inputs.tfvars
```

## Resources

| Resource | Name |
|----------|------|
| Lambda Function (API) | `pedalboard-demo-prod-processor` |
| Lambda Function (Worker) | `pedalboard-demo-prod-worker` |
| ECR Repository | `pedalboard-demo/lambda` |
| Frontend S3 Bucket | `pedalboard-demo-prod-frontend` |
| Audio S3 Bucket | `pedalboard-demo-prod-audio` |
| DynamoDB Table | `pedalboard-demo-prod-jobs` |
| SQS Queue | `pedalboard-demo-prod-jobs` |
| SQS Dead Letter Queue | `pedalboard-demo-prod-jobs-dlq` |

Environment-specific values (AWS Account ID, CloudFront ID, etc.) are defined in `.envrc`.
