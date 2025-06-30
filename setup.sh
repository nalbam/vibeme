#!/bin/bash

set -e

echo "🔧 시스템 업데이트"
sudo dnf update -y

echo "🔧 필수 도구 설치: git, curl, unzip"
sudo dnf install -y git curl unzip tar

echo "🔧 AWS CLI v2 설치"
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf awscliv2.zip aws/

echo "🔧 Node.js 18 설치"
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

echo "🔧 PM2 설치"
sudo npm install -g pm2

echo "🔧 ffmpeg 설치 (static binary)"
cd /usr/local/bin
sudo curl -LO https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz
sudo tar -xf ffmpeg-release-arm64-static.tar.xz
cd ffmpeg-*-static
sudo cp ffmpeg ffprobe /usr/local/bin/
cd ..
sudo rm -rf ffmpeg-*-static ffmpeg-release-arm64-static.tar.xz

echo "✅ 설치 완료:"
node -v
npm -v
aws --version
git --version
ffmpeg -version
