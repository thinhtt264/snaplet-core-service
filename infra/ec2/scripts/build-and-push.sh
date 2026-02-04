#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_EC2="$(dirname "$SCRIPT_DIR")"
CONFIG="${INFRA_EC2}/config.env"

if [ ! -f "$CONFIG" ]; then
  echo "Missing config: $CONFIG"
  exit 1
fi

# Single source of truth
set -a
# shellcheck source=../config.env
source "$CONFIG"
set +a

export ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
export IMAGE_URI="${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"

# Build từ infra/ec2: compose + Dockerfile đều trong đây, context = repo root
echo "== BUILD (docker compose build ${COMPOSE_SERVICE}) =="
REPO_ROOT="$(cd "$INFRA_EC2/../.." && pwd)"
cd "$INFRA_EC2"
docker compose -f docker-compose.yml build "${COMPOSE_SERVICE}"
# Image đã được tag ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG} bởi compose

echo "== CHECK AWS CREDENTIALS =="
if ! aws sts get-caller-identity --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "ERROR: AWS session expired or not configured. Run one of:"
  echo "  aws configure"
  echo "Then re-run this script."
  exit 1
fi

echo "== LOGIN ECR =="
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "== PUSH =="
docker push "$IMAGE_URI"

echo "== BUILD & PUSH OK: $IMAGE_URI =="
