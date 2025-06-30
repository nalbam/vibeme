#!/bin/bash

# 시스템 업데이트
sudo yum update -y

# Git 설치
sudo yum install -y git

# AWS CLI 설치 (v2)
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf awscliv2.zip aws/

# Node.js 설치 (LTS 18.x 기준)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# PM2 (Node.js 프로세스 관리자)
sudo npm install -g pm2

# ffmpeg 설치 (EPEL 통해)
sudo amazon-linux-extras enable epel
sudo yum install -y epel-release
sudo yum install -y ffmpeg

# 확인
echo "✅ 설치 완료:"
node -v
npm -v
aws --version
git --version
ffmpeg -version
