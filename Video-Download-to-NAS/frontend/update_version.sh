#!/bin/sh
# Frontend 버전 자동 업데이트 스크립트

VERSION_FILE="/app/VERSION"
PACKAGE_FILE="/app/package.json"

if [ -f "$VERSION_FILE" ]; then
    VERSION=$(cat "$VERSION_FILE")
    echo "📦 Updating frontend version to: $VERSION"
    
    # package.json 업데이트 (sed를 사용하여 버전 교체)
    sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$PACKAGE_FILE"
    
    echo "✅ Frontend version updated successfully"
else
    echo "⚠️  VERSION file not found, skipping version update"
fi
