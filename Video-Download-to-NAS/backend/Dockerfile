FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy VERSION file from server root
COPY VERSION ./VERSION

# Copy BUILD_TIME file (created by build.sh)
COPY backend/BUILD_TIME ./BUILD_TIME

# Copy requirements and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Upgrade yt-dlp to latest version
RUN pip install --no-cache-dir --upgrade yt-dlp

# Copy application code
COPY backend/app ./app

# Copy test files
COPY backend/test_*.py ./

# Copy legal documents to app root
COPY LICENSE /app/LICENSE
COPY PRIVACY_POLICY.md /app/PRIVACY_POLICY.md
COPY TERMS_OF_SERVICE.md /app/TERMS_OF_SERVICE.md

# Copy version update script
COPY backend/update_version.sh /app/update_version.sh
RUN chmod +x /app/update_version.sh

# Update version in code
RUN /app/update_version.sh

# Copy startup script
COPY backend/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Create necessary directories
RUN mkdir -p /app/downloads /app/data

# Expose port
EXPOSE 8000

# Run the application with startup script
CMD ["/app/start.sh"]
