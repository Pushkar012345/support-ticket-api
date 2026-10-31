# Start from an official image that already has Python 3.13
FROM python:3.13-slim

# Don't write .pyc files, and print logs immediately
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# All following commands run inside /app in the container
WORKDIR /app

# Copy requirements first and install. Docker caches this layer,
# so rebuilds are fast unless requirements.txt changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the project code
COPY . .

EXPOSE 8000