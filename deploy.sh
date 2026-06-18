#!/usr/bin/env bash
# 一鍵部署：push main + 同步 gh-pages（GitHub Pages 從 gh-pages 分支出站）
# 用法：bash deploy.sh
set -e
cd "$(dirname "$0")"
echo "→ push main"
git push origin main
echo "→ 同步 gh-pages（subtree split public/）"
git push origin "$(git subtree split --prefix public main)":gh-pages --force
echo "✅ main + gh-pages 已更新；GitHub Pages 會自動重建（約 1–2 分鐘）"
