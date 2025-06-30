#!/bin/bash
set -e

echo "🔧 시스템 패키지 업데이트"
sudo dnf update -y

echo "🔧 curl-minimal → curl 교체"
sudo dnf swap -y curl-minimal curl

echo "📦 필수 도구 설치: git, curl, unzip, tar"
sudo dnf install -y git curl unzip tar

echo "📥 AWS CLI v2 설치"
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf awscliv2.zip aws/

echo "📥 Node.js 18 설치"
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

echo "📥 PM2 글로벌 설치"
sudo npm install -g pm2

echo "📥 ffmpeg (static binary) 설치"
cd /usr/local/bin
sudo curl -LO https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz
sudo tar -xf ffmpeg-release-arm64-static.tar.xz
cd ffmpeg-*-static
sudo cp ffmpeg ffprobe /usr/local/bin/
cd ..
sudo rm -rf ffmpeg-*-static ffmpeg-release-arm64-static.tar.xz

echo "✅ 모든 설치 완료. 버전 확인 결과:"
echo ""
echo "🟢 Node.js:     $(node -v)"
echo "🟢 npm:         $(npm -v)"
echo "🟢 pm2:         $(pm2 -v)"
echo "🟢 AWS CLI:     $(aws --version)"
echo "🟢 Git:         $(git --version)"
echo "🟢 ffmpeg:      $(ffmpeg -version | head -n 1)"
