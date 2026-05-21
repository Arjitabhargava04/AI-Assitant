# Use official Python 3.11 slim image
FROM python:3.11-slim

# Set working directory inside container
WORKDIR /app

# Install system dependencies (needed for some Python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Expose port 8000
EXPOSE 8000

# Run uvicorn server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]