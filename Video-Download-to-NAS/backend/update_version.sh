#!/bin/bash
# Backend 버전 자동 업데이트 스크립트

VERSION_FILE="/app/VERSION"
INIT_FILE="/app/app/__init__.py"
MAIN_FILE="/app/app/main.py"

if [ -f "$VERSION_FILE" ]; then
    VERSION=$(cat "$VERSION_FILE")
    echo "📦 Updating backend version to: $VERSION"
    
    # __init__.py 업데이트
    sed -i "s/__version__ = \".*\"/__version__ = \"$VERSION\"/" "$INIT_FILE"
    
    # main.py의 FastAPI version 업데이트
    sed -i "s/version=\".*\"/version=\"$VERSION\"/" "$MAIN_FILE"
    
    # main.py의 root endpoint version 업데이트
    sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$MAIN_FILE"
    
    echo "✅ Backend version updated successfully"
else
    echo "⚠️  VERSION file not found, skipping version update"
fi
