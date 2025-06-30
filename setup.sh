#!/bin/bash

set -e

echo "📦 시스템 업데이트 중..."
sudo dnf update -y

echo "🔧 curl-minimal 제거 및 일반 curl 설치 (충돌 방지)"
sudo dnf swap -y curl-minimal curl

echo "📦 기본 도구 설치: git, curl, unzip, tar"
sudo dnf install -y git curl unzip tar

echo "🔧 AWS CLI v2 설치"
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf awscliv2.zip aws/
echo "✅ AWS CLI 설치 완료: $(aws --version)"

echo "🔧 Node.js 18 설치"
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs
echo "✅ Node.js 설치 완료: $(node -v), npm: $(npm -v)"

echo "🔧 PM2 글로벌 설치"
sudo npm install -g pm2
echo "✅ PM2 버전: $(pm2 -v)"

echo "🔧 ffmpeg (static binary) 설치"
cd /usr/local/bin
sudo curl -LO https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz
sudo tar -xf ffmpeg-release-arm64-static.tar.xz
cd ffmpeg-*-static
sudo cp ffmpeg ffprobe /usr/local/bin/
cd ..
sudo rm -rf ffmpeg-*-static ffmpeg-release-arm64-static.tar.xz
echo "✅ ffmpeg 설치 완료: $(ffmpeg -version | head -n 1)"

echo "🎉 전체 설치 완료!"
