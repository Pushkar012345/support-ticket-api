#!/usr/bin/env bash
set -e
python -c "import os; print('CORS_ALLOWED_ORIGINS repr:', repr(os.environ.get('CORS_ALLOWED_ORIGINS')))"
python manage.py migrate --noinput
if [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py createsuperuser --noinput || true
fi
celery -A config worker -l info --pool=solo &
exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2