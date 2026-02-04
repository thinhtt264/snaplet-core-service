#!/bin/bash
set -e

# Chạy lệnh trên EC2; tự đọc config.env và dùng SSH_KEY_PATH nếu có.
# Usage: ssh-exec.sh <remote command>
# Ví dụ: bash ssh-exec.sh "bash /home/ec2-user/infra/scripts/verify.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$(dirname "$SCRIPT_DIR")/config.env"
if [ ! -f "$CONFIG" ]; then
  echo "Missing config: $CONFIG"
  echo "  (config.env nằm trong .gitignore — tạo file infra/ec2/config.env và chạy từ thư mục gốc repo.)"
  exit 1
fi
set -a
# shellcheck source=../config.env
source "$CONFIG"
set +a

if [ -z "${EC2_HOST}" ] || [ "${EC2_HOST}" = "EC2_IP_HERE" ]; then
  echo "ERROR: Chưa cấu hình EC2. Sửa infra/ec2/config.env: EC2_HOST=..."
  exit 1
fi

REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SSH_OPTS="-o StrictHostKeyChecking=accept-new"
if [ -n "${SSH_KEY_PATH:-}" ] && [ -f "$REPO_ROOT/$SSH_KEY_PATH" ]; then
  SSH_OPTS="-i $REPO_ROOT/$SSH_KEY_PATH $SSH_OPTS"
fi

exec ssh $SSH_OPTS "${EC2_USER}@${EC2_HOST}" "$@"
