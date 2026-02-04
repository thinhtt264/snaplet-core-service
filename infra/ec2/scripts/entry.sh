#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$(dirname "$SCRIPT_DIR")/config.env"
if [ ! -f "$CONFIG" ]; then
  echo "Missing config: $CONFIG"
  exit 1
fi
set -a
# shellcheck source=../config.env
source "$CONFIG"
set +a

if [ -z "${EC2_HOST}" ] || [ "${EC2_HOST}" = "EC2_IP_HERE" ]; then
  echo "ERROR: Chưa cấu hình EC2. Sửa infra/ec2/config.env: đặt EC2_HOST=IP-hoặc-hostname-EC2 của bạn."
  exit 1
fi

REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

# Entry chỉ điều hướng; mỗi script tự đọc config (EC2, SSH key, ...)
echo "== BUILD & PUSH (docker compose build + ECR) =="
bash infra/ec2/scripts/build-and-push.sh

echo "== SYNC =="
bash infra/ec2/scripts/sync.sh

echo "== BOOTSTRAP (optional) =="
bash infra/ec2/scripts/ssh-exec.sh "bash ${EC2_DEPLOY_DIR}/scripts/bootstrap.sh"

echo "== DEPLOY =="
bash infra/ec2/scripts/ssh-exec.sh "APP_DIR=${EC2_DEPLOY_DIR} bash ${EC2_DEPLOY_DIR}/scripts/deploy.sh"

echo "== VERIFY =="
bash infra/ec2/scripts/ssh-exec.sh "bash ${EC2_DEPLOY_DIR}/scripts/verify.sh"
