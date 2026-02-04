#!/bin/bash
set -e

# Chỉ cài khi chưa có, tránh chạy thừa (EC2 có thể đã cài sẵn Docker, compose, AWS CLI)

echo "== Basic tools =="
for cmd in curl unzip jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    sudo dnf install -y curl unzip jq
    break
  fi
done
command -v curl >/dev/null && command -v jq >/dev/null && echo "  already installed" || true

echo "== Docker =="
if ! command -v docker >/dev/null 2>&1; then
  sudo dnf install -y docker
  sudo systemctl enable docker
  sudo systemctl start docker
  sudo usermod -aG docker ec2-user
  NEED_LOGOUT=1
else
  echo "  already installed"
fi

echo "== Docker Compose v2 =="
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p "$DOCKER_CONFIG/cli-plugins"
if [ ! -x "$DOCKER_CONFIG/cli-plugins/docker-compose" ]; then
  curl -SL https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-aarch64 \
    -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
  chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"
else
  echo "  already installed"
fi

echo "== AWS CLI =="
if ! command -v aws >/dev/null 2>&1; then
  curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o awscliv2.zip
  unzip -q awscliv2.zip
  sudo ./aws/install
  rm -rf aws awscliv2.zip
else
  echo "  already installed"
fi

echo "== CloudWatch Agent =="
if ! rpm -q amazon-cloudwatch-agent >/dev/null 2>&1; then
  sudo dnf install -y amazon-cloudwatch-agent
else
  echo "  already installed"
fi

echo "== Nginx =="
if ! command -v nginx >/dev/null 2>&1; then
  sudo dnf install -y nginx
  sudo systemctl enable nginx
else
  echo "  already installed"
fi

echo "== Certbot (Let's Encrypt) =="
if ! command -v certbot >/dev/null 2>&1; then
  if dnf list installed epel-release &>/dev/null; then
    :
  else
    sudo dnf install -y epel-release 2>/dev/null || true
  fi
  sudo dnf install -y certbot python3-certbot-nginx 2>/dev/null || \
    sudo dnf install -y certbot 2>/dev/null || echo "  certbot: cài tay nếu cần (dnf install certbot python3-certbot-nginx)"
else
  echo "  already installed"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
[ -f "${DEPLOY_DIR}/config.env" ] && set -a && source "${DEPLOY_DIR}/config.env" && set +a

echo "== Nginx SSL (self-signed) + config =="
NGINX_SSL="/etc/nginx/ssl"
NGINX_CONF_SRC="${DEPLOY_DIR}/nginx/app.conf"

sudo mkdir -p "$NGINX_SSL"
if [ ! -f "$NGINX_SSL/self-signed.crt" ]; then
  sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$NGINX_SSL/self-signed.key" -out "$NGINX_SSL/self-signed.crt" \
    -subj "/CN=localhost"
  echo "  self-signed cert created"
else
  echo "  self-signed cert already exists"
fi

if [ -f "$NGINX_CONF_SRC" ]; then
  sudo rm -f /etc/nginx/conf.d/default.conf 2>/dev/null
  sudo cp "$NGINX_CONF_SRC" /etc/nginx/conf.d/app.conf
  if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx 2>/dev/null || sudo systemctl start nginx
    echo "  nginx config deployed, reloaded"
  else
    echo "  nginx -t failed, kiểm tra config"
  fi
else
  echo "  skip nginx app.conf (not found at $NGINX_CONF_SRC)"
fi

# Certbot real cert: chạy khi đã có DOMAIN trỏ về EC2 (port 80 mở)
if [ -n "${DOMAIN:-}" ]; then
  echo "== Certbot cho domain $DOMAIN =="
  if command -v certbot >/dev/null 2>&1; then
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email 2>/dev/null && echo "  OK" || echo "  thất bại (kiểm tra DNS trỏ EC2, port 80 mở)"
  fi
fi

echo "== Done =="
[ -n "${NEED_LOGOUT:-}" ] && echo "Logout & login again for docker group" || true
exit 0
