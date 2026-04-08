FROM python:3.11-slim

WORKDIR /app

# System libs required by MediaPipe (libGL) and Pillow / OpenCV.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY . .

# Render (and most PaaS) inject a $PORT env var that the service must bind to.
# We default to 8000 for local development where $PORT is not set.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
