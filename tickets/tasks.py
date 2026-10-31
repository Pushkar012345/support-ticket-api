import logging

import requests
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from .models import Ticket

logger = logging.getLogger(__name__)

# Groq's API follows the same format as OpenAI's chat API
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = (
    "You are a polite, concise customer support agent. "
    "Write a short reply (under 120 words) to the customer's ticket. "
    "Acknowledge the problem, suggest one or two concrete next steps, and ask for any "
    "missing details. Never promise refunds, deadlines, or account changes. "
    "Reply with the message text only."
)


@shared_task
def send_ticket_created_email(ticket_id):
    """Unchanged from Step 10."""
    try:
        ticket = Ticket.objects.select_related("created_by").get(pk=ticket_id)
    except Ticket.DoesNotExist:
        return

    send_mail(
        subject=f"[Ticket #{ticket.id}] We received your request",
        message=(
            f"Hi {ticket.created_by.username},\n\n"
            f"Your ticket \"{ticket.title}\" has been created. "
            f"Our team will get back to you soon.\n"
        ),
        from_email=None,
        recipient_list=[ticket.created_by.email],
    )


# autoretry_for: if the network call fails (timeout, 5xx, rate limit), Celery retries
#   the task by itself. retry_backoff=True waits longer each time (1s, 2s, 4s...).
# max_retries=3: give up after 3 retries so a broken key doesn't retry forever.
@shared_task(
    autoretry_for=(requests.RequestException,),
    retry_backoff=True,
    max_retries=3,
)
def generate_ai_reply(ticket_id):
    """Ask the LLM for a suggested reply and save it on the ticket."""
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set, skipping AI reply for ticket %s", ticket_id)
        return

    try:
        ticket = Ticket.objects.get(pk=ticket_id)
    except Ticket.DoesNotExist:
        return

    response = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
        json={
            "model": settings.GROQ_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    # [:2000] caps the size so one huge ticket can't run up cost
                    "content": f"Title: {ticket.title}\n\nDescription:\n{ticket.description[:2000]}",
                },
            ],
            "temperature": 0.4,  # lower = more consistent, less creative
            "max_tokens": 1000,
        },
        timeout=20,  # never wait forever on a network call
    )
        # Log Groq's own explanation (e.g. "model not found") before raising
    if response.status_code >= 400:
        logger.error("Groq API error %s: %s", response.status_code, response.text[:500])
    response.raise_for_status()
    response.raise_for_status()  # turns 4xx/5xx into an exception, which triggers the retry

        # .get(...) or "" keeps this safe if the model returned no text
    reply = (response.json()["choices"][0]["message"].get("content") or "").strip()
    if not reply:
        logger.warning("Groq returned an empty reply for ticket %s", ticket_id)
        return

    # update_fields writes only this column, so it can't overwrite other changes
    # (for example an agent changing the status at the same moment).
    ticket.ai_suggested_reply = reply
    ticket.save(update_fields=["ai_suggested_reply", "updated_at"])