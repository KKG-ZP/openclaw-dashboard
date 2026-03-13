#!/bin/bash

# OpenClaw Dashboard 启动脚本
# 默认前台运行；可用 --daemon 安装并启动 systemd 用户服务常驻后台

cd "$(dirname "$0")"

if [ "${1:-}" = "--daemon" ]; then
    ./scripts/install-user-service.sh
    exit 0
fi

echo "🎩 启动OpenClaw作战指挥中心看板..."
echo ""

# 检查端口是否被占用
if lsof -ti:44132 > /dev/null 2>&1; then
    echo "⚠️  端口44132已被占用，正在停止旧进程..."
    lsof -ti:44132 | xargs kill -9 2>/dev/null
    sleep 2
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    npm install
    echo ""
fi

# 启动服务器
echo "🚀 启动服务器..."
echo "   访问地址: http://127.0.0.1:44132"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

# 前台运行
node server.js
