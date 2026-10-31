import pytest

from config.celery import app


@pytest.fixture(autouse=True)
def celery_eager():
    app.conf.task_always_eager = True
    app.conf.task_eager_propagates = True


# Safety net: even if you have a real key in .env, tests must never call the real API.
@pytest.fixture(autouse=True)
def no_real_ai(settings):
    settings.GROQ_API_KEY = ""