#!/bin/bash
set -e

# Chạy trên EC2: ECR/AWS lấy từ config.env (bắt buộc config); app vars từ .env
APP_DIR="${APP_DIR:-$(pwd)}"
CONFIG_FILE="${APP_DIR}/config.env"
ENV_FILE="${APP_DIR}/.env"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Missing config.env on EC2: $CONFIG_FILE (cần AWS_REGION, AWS_ACCOUNT_ID, ECR_REPOSITORY)"
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing .env on EC2: $ENV_FILE (compose cần file này để chạy service)"
  exit 1
fi

set -a
# .env trước (app), config.env sau để ECR/AWS từ config luôn ghi đè
# shellcheck source=/dev/null
source "$ENV_FILE"
# shellcheck source=/dev/null
source "$CONFIG_FILE"
set +a

# Bắt buộc có trong config.env — không fallback
for var in AWS_REGION AWS_ACCOUNT_ID ECR_REPOSITORY; do
  if [ -z "${!var}" ]; then
    echo "ERROR: Thiếu $var trong config.env. Phải cấu hình đủ rồi sync lại."
    exit 1
  fi
done
export ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
export IMAGE_TAG="${IMAGE_TAG:-latest}"
export AWSLOGS_GROUP="${AWSLOGS_GROUP:-/ec2/snaplet/core-service}"
export AWSLOGS_STREAM="${AWSLOGS_STREAM:-core-service}"

cd "$APP_DIR"

echo "== CloudWatch log group (tạo nếu chưa có) =="
aws logs create-log-group --log-group-name "${AWSLOGS_GROUP}" --region "$AWS_REGION" 2>/dev/null && echo "  created: ${AWSLOGS_GROUP}" || echo "  đã tồn tại hoặc đã tạo: ${AWSLOGS_GROUP}"

echo "== LOGIN ECR (region=$AWS_REGION, registry=$ECR_REGISTRY) =="
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "== PULL & UP (xóa container cũ nếu có rồi tạo mới) =="
docker-compose pull
# Xóa container cũ theo tên để tránh Conflict (compose có thể không nhận container do project khác)
docker rm -f "${CONTAINER_NAME:-snaplet-core-service}" 2>/dev/null || true
docker-compose up -d

echo "== Nginx (đảm bảo config + 443 cho verify) =="
if [ -f "${APP_DIR}/nginx/app.conf" ]; then
  sudo mkdir -p /etc/nginx/ssl
  [ ! -f /etc/nginx/ssl/self-signed.crt ] && sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/self-signed.key -out /etc/nginx/ssl/self-signed.crt -subj "/CN=localhost" 2>/dev/null || true
  sudo rm -f /etc/nginx/conf.d/default.conf 2>/dev/null
  sudo cp "${APP_DIR}/nginx/app.conf" /etc/nginx/conf.d/app.conf
  sudo nginx -t 2>/dev/null && (sudo systemctl start nginx 2>/dev/null || sudo systemctl reload nginx 2>/dev/null) || true
fi
