#!/bin/bash
set -euo pipefail

PROJECT_DIR="/Users/kim/Documents/Workspace/Project_03_subscription-manager-web"
HOST_VALUE="${HOST:-127.0.0.1}"
PORT_VALUE="${PORT:-5173}"

cd "$PROJECT_DIR"

if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:"$PORT_VALUE" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "端口 $PORT_VALUE 已被占用，请关闭占用进程或使用 PORT=其他端口 ./start-subscription-manager.sh"
    exit 1
  fi
fi

echo "订阅管理服务启动中..."
echo "访问地址：http://$HOST_VALUE:$PORT_VALUE"
HOST="$HOST_VALUE" PORT="$PORT_VALUE" npm start
