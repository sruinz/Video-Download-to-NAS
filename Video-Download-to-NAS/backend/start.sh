#!/bin/bash

echo "🔄 Updating yt-dlp to latest version..."
pip install --no-cache-dir --upgrade yt-dlp

echo "✅ yt-dlp updated successfully"
echo "🚀 Starting application..."

# Start the application
uvicorn app.main:app --host 0.0.0.0 --port 8000
