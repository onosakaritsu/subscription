#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_VALUE="${HOST:-127.0.0.1}"
PORT_VALUE="${PORT:-5173}"

cd "$SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js。请先安装 Node.js 20 或更新版本。"
  exit 1
fi

NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "当前 Node.js 版本低于 20，请升级后再启动。"
  node --version
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:"$PORT_VALUE" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "端口 $PORT_VALUE 已被占用。请关闭占用进程，或使用 PORT=其他端口 ./start-subscription-manager.sh"
    exit 1
  fi
else
  echo "未找到 lsof，跳过端口占用预检查。"
fi

echo "订阅管理服务启动中..."
echo "访问地址：http://$HOST_VALUE:$PORT_VALUE"
echo "如需停止服务，请在当前终端按 Ctrl+C。"
HOST="$HOST_VALUE" PORT="$PORT_VALUE" npm start
