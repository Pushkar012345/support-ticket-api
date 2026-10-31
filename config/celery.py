import os

from celery import Celery

# Tell Celery which Django settings to use
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("config")

# Read any setting that starts with CELERY_ from settings.py (e.g. CELERY_BROKER_URL)
app.config_from_object("django.conf:settings", namespace="CELERY")

# Look for a tasks.py file in every installed app
app.autodiscover_tasks()