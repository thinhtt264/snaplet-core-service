#!/bin/bash
set -e

CONTAINER_NAME="${CONTAINER_NAME:-snaplet-core-service}"

echo "== Docker containers =="
docker ps

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "FAIL: Container ${CONTAINER_NAME} không chạy."
  exit 1
fi

echo "== HTTPS (nginx + port 443) =="
NGINX_OK=false
PORT443_OK=false
systemctl is-active nginx &>/dev/null && NGINX_OK=true
ss -tlnp 2>/dev/null | grep -q ':443 ' && PORT443_OK=true
if [ "$NGINX_OK" = true ] && [ "$PORT443_OK" = true ]; then
  echo "  OK: nginx active, port 443 listening"
else
  echo "  FAIL: nginx=$NGINX_OK, port 443=$PORT443_OK"
fi

echo "== VERIFY OK: ${CONTAINER_NAME} đang chạy =="
