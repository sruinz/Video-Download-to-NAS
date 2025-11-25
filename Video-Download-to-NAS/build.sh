#!/bin/bash
# VDTN Docker 이미지 빌드 스크립트

set -e  # 에러 발생 시 중단

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 버전 읽기
VERSION=$(cat VERSION)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}VDTN Docker Image Build${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 기본 이미지 이름
BACKEND_IMAGE="${BACKEND_IMAGE:-sruinz/vdtnsvr-backend}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-sruinz/vdtnsvr-frontend}"

# 빌드 옵션
NO_CACHE=""
WITH_VERSION=false

for arg in "$@"; do
    case $arg in
        --no-cache)
            NO_CACHE="--no-cache"
            echo -e "${BLUE}🔄 Building with --no-cache${NC}"
            ;;
        --with-version)
            WITH_VERSION=true
            echo -e "${BLUE}📌 Building with version tag: ${VERSION}${NC}"
            ;;
    esac
done

# Backend 빌드
echo -e "${GREEN}📦 Building Backend...${NC}"

# 빌드 시간 저장 (ISO 8601 UTC 형식)
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "${BUILD_TIME}" > backend/BUILD_TIME
echo -e "${BLUE}📝 Build time: ${BUILD_TIME}${NC}"

# 버전 태그 옵션
VERSION_TAG=""
if [ "$WITH_VERSION" = true ]; then
    VERSION_TAG="-t ${BACKEND_IMAGE}:${VERSION}"
fi

docker build $NO_CACHE \
    -f backend/Dockerfile \
    -t ${BACKEND_IMAGE}:latest \
    $VERSION_TAG \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend build successful${NC}"
else
    echo -e "${RED}❌ Backend build failed${NC}"
    exit 1
fi

echo ""

# Frontend 빌드
echo -e "${GREEN}📦 Building Frontend...${NC}"

# Frontend는 같은 빌드 시간 사용
echo "${BUILD_TIME}" > frontend/BUILD_TIME

# 버전 태그 옵션
VERSION_TAG=""
if [ "$WITH_VERSION" = true ]; then
    VERSION_TAG="-t ${FRONTEND_IMAGE}:${VERSION}"
fi

docker build $NO_CACHE \
    -f frontend/Dockerfile \
    -t ${FRONTEND_IMAGE}:latest \
    $VERSION_TAG \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend build successful${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ All images built successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Built Images:"
echo -e "  - ${BACKEND_IMAGE}:latest"
echo -e "  - ${FRONTEND_IMAGE}:latest"

if [ "$WITH_VERSION" = true ]; then
    echo -e "  - ${BACKEND_IMAGE}:${VERSION}"
    echo -e "  - ${FRONTEND_IMAGE}:${VERSION}"
fi

echo ""
echo -e "${BLUE}To push images:${NC}"
echo -e "  docker push ${BACKEND_IMAGE}:latest"
echo -e "  docker push ${FRONTEND_IMAGE}:latest"

if [ "$WITH_VERSION" = true ]; then
    echo -e "  docker push ${BACKEND_IMAGE}:${VERSION}"
    echo -e "  docker push ${FRONTEND_IMAGE}:${VERSION}"
fi

echo ""
echo -e "${BLUE}Options:${NC}"
echo -e "  --no-cache      Build without cache"
echo -e "  --with-version  Also tag with version number (${VERSION})"
