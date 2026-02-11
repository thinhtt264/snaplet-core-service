#!/bin/bash
set -e

# =============================================================================
# UPDATE SERVICE ONLY - Chỉ update code container, KHÔNG đụng nginx/ssl/bootstrap
# Dùng khi hạ tầng đã chạy ổn, chỉ muốn deploy code mới
# Usage: pnpm infra:update
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$(dirname "$SCRIPT_DIR")/config.env"
if [ ! -f "$CONFIG" ]; then
  echo "Missing config: $CONFIG"
  exit 1
fi
set -a
source "$CONFIG"
set +a

if [ -z "${EC2_HOST}" ] || [ "${EC2_HOST}" = "EC2_IP_HERE" ]; then
  echo "ERROR: Chưa cấu hình EC2. Sửa infra/ec2/config.env"
  exit 1
fi

REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================"
echo "UPDATE SERVICE ONLY (không đụng nginx/ssl)"
echo "========================================"

# 1. Build & Push image mới
echo ""
echo "== [1/3] BUILD & PUSH =="
bash infra/ec2/scripts/build-and-push.sh

# 2. Sync infra lên EC2, rồi SSH vào pull + restart container
echo ""
echo "== [2/3] SYNC + PULL & RESTART CONTAINER =="
echo 'Sync infra/ec2 → EC2...'
bash infra/ec2/scripts/sync.sh

echo 'SSH: pull image & restart...'
bash infra/ec2/scripts/ssh-exec.sh "
set -e
cd ${EC2_DEPLOY_DIR}

# Load config
set -a
source .env
source config.env
set +a

export ECR_REGISTRY=\"\${AWS_ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com\"

echo 'Login ECR...'
aws ecr get-login-password --region \"\$AWS_REGION\" | docker login --username AWS --password-stdin \"\$ECR_REGISTRY\"

echo 'Pull new image...'
docker-compose pull

echo 'Restart container (giữ nguyên config, chỉ dùng image mới)...'
docker-compose up -d --no-deps --force-recreate ${COMPOSE_SERVICE}

echo 'Sync nginx config...'
sudo rsync -av nginx/app.conf /etc/nginx/conf.d/app.conf
sudo nginx -t 2>/dev/null && sudo systemctl reload nginx 2>/dev/null || true

echo 'Container status:'
docker ps --filter name=${CONTAINER_NAME} --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
"

# 3. Verify
echo ""
echo "== [3/3] VERIFY =="
bash infra/ec2/scripts/ssh-exec.sh "
echo 'Waiting 5s for container to start...'
sleep 5

echo 'Health check (HTTP):'
curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:4040/api/v1/health || echo ' (failed)'
echo ''

echo 'Health check (via Nginx HTTPS):'
curl -sk -o /dev/null -w 'HTTPS %{http_code}' https://localhost/api/v1/health || echo ' (failed)'
echo ''

echo 'Container logs (last 10 lines):'
docker logs --tail 10 ${CONTAINER_NAME} 2>&1 || true
"

echo ""
echo "========================================"
echo "UPDATE COMPLETE"
echo "========================================"
