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

# Compose trên EC2 nạp .env thì service mới chạy được — bắt buộc có file này
if [ ! -f "infra/ec2/.env" ]; then
  echo "ERROR: Thiếu infra/ec2/.env (biến môi trường cho app, compose dùng file này trên EC2). Tạo file rồi chạy lại."
  exit 1
fi

SSH_KEY=""
if [ -n "${SSH_KEY_PATH:-}" ] && [ -f "$REPO_ROOT/$SSH_KEY_PATH" ]; then
  SSH_KEY="$REPO_ROOT/$SSH_KEY_PATH"
fi
# BatchMode=yes: không chờ prompt (host key/password), tránh treo; ConnectTimeout + ServerAlive để không hang
SSH_OPTS="-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -o ServerAliveInterval=5 -o ServerAliveCountMax=3"
SSH_CMD="ssh $SSH_OPTS"
[ -n "$SSH_KEY" ] && SSH_CMD="ssh -i $SSH_KEY $SSH_OPTS"

# Kiểm tra SSH trước
if ! $SSH_CMD "${EC2_USER}@${EC2_HOST}" "true" 2>/dev/null; then
  echo "ERROR: Không kết nối được SSH tới ${EC2_USER}@${EC2_HOST}"
  echo "  Connection refused: kiểm tra instance, security group port 22, sshd trên EC2, EC2_USER (ec2-user/ubuntu)."
  exit 1
fi

# Trên EC2: xóa nội dung thư mục cũ rồi thay bằng bản mới
echo "== Xóa nội dung ${EC2_DEPLOY_DIR} trên EC2 =="
$SSH_CMD "${EC2_USER}@${EC2_HOST}" "mkdir -p ${EC2_DEPLOY_DIR} && (cd ${EC2_DEPLOY_DIR} && find . -mindepth 1 -delete)" && echo "  Xong."

# Sync infra/ec2 lên EC2 (config.env để deploy đọc AWS_REGION/ECR; không đưa secrets)
echo "== Rsync infra/ec2 → EC2 =="
rsync -avz -e "$SSH_CMD" --exclude='secrets' infra/ec2/ "${EC2_USER}@${EC2_HOST}:${EC2_DEPLOY_DIR}/"
echo "  Xong."
