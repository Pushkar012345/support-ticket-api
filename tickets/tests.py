import pytest
from rest_framework.test import APIClient
from django.core import mail
from accounts.models import User
from tickets.models import Ticket
from tickets.tasks import generate_ai_reply
# Gives every test in this file access to the database.
# pytest-django creates a separate, empty TEST database for the run and throws it away after,
# so your real data (alice, your tickets) is never touched.
pytestmark = pytest.mark.django_db


# ---------- helpers and fixtures ----------

def make_user(username, role):
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="StrongPass123!",
        role=role,
    )


def client_for(user):
    """Returns an API client that is already logged in as `user`.
    force_authenticate skips the JWT step, so these tests focus on permissions."""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# A fixture builds something a test needs. A test asks for it by putting its name as a parameter.
@pytest.fixture
def customer():
    return make_user("alice", User.Role.CUSTOMER)


@pytest.fixture
def other_customer():
    return make_user("bob", User.Role.CUSTOMER)


@pytest.fixture
def agent():
    return make_user("agent1", User.Role.AGENT)


@pytest.fixture
def admin():
    return make_user("admin1", User.Role.ADMIN)


# ---------- auth tests ----------

def test_register_creates_customer_even_if_role_sent():
    # Someone tries to sign up as an admin by adding "role" to the JSON
    res = APIClient().post(
        "/api/auth/register/",
        {"username": "eve", "email": "eve@example.com",
         "password": "StrongPass123!", "role": "admin"},
        format="json",
    )
    assert res.status_code == 201
    # The role must have been ignored
    assert User.objects.get(username="eve").role == User.Role.CUSTOMER


def test_jwt_login_returns_tokens(customer):
    res = APIClient().post(
        "/api/auth/token/",
        {"username": "alice", "password": "StrongPass123!"},
        format="json",
    )
    assert res.status_code == 200
    assert "access" in res.data and "refresh" in res.data


def test_unauthenticated_cannot_list_tickets():
    # No login at all -> 401
    assert APIClient().get("/api/tickets/").status_code == 401


# ---------- ticket tests ----------

def test_customer_creates_ticket(customer):
    res = client_for(customer).post(
        "/api/tickets/",
        {"title": "Cannot login", "description": "Error 500"},
        format="json",
    )
    assert res.status_code == 201
    # created_by must come from the logged-in user, not from the request body
    assert Ticket.objects.get().created_by == customer


def test_customer_sees_only_own_tickets(customer, other_customer):
    Ticket.objects.create(title="A", description="x", created_by=customer)
    Ticket.objects.create(title="B", description="y", created_by=other_customer)

    res = client_for(customer).get("/api/tickets/")
    assert res.data["count"] == 1
    assert res.data["results"][0]["title"] == "A"


def test_customer_cannot_update_status(customer):
    ticket = Ticket.objects.create(title="A", description="x", created_by=customer)
    res = client_for(customer).patch(
        f"/api/tickets/{ticket.id}/", {"status": "closed"}, format="json"
    )
    assert res.status_code == 403  # logged in, but role not allowed


def test_only_admin_can_assign(customer, agent, admin):
    ticket = Ticket.objects.create(title="A", description="x", created_by=customer)

    # An agent trying to assign is blocked
    res = client_for(agent).post(
        f"/api/tickets/{ticket.id}/assign/", {"agent_id": agent.id}, format="json"
    )
    assert res.status_code == 403

    # An admin can assign
    res = client_for(admin).post(
        f"/api/tickets/{ticket.id}/assign/", {"agent_id": agent.id}, format="json"
    )
    assert res.status_code == 200
    ticket.refresh_from_db()  # reload the row from the database to see the change
    assert ticket.assigned_to == agent
    assert ticket.status == Ticket.Status.IN_PROGRESS


def test_agent_sees_only_assigned_and_can_update(customer, agent):
    mine = Ticket.objects.create(
        title="Mine", description="x", created_by=customer, assigned_to=agent
    )
    Ticket.objects.create(title="Not mine", description="y", created_by=customer)

    client = client_for(agent)
    assert client.get("/api/tickets/").data["count"] == 1

    res = client.patch(f"/api/tickets/{mine.id}/", {"status": "resolved"}, format="json")
    assert res.status_code == 200
    assert res.data["status"] == "resolved"


def test_comments_and_access_control(customer, other_customer):
    ticket = Ticket.objects.create(title="A", description="x", created_by=customer)

    # The owner can comment
    res = client_for(customer).post(
        f"/api/tickets/{ticket.id}/comments/", {"body": "Any update?"}, format="json"
    )
    assert res.status_code == 201

    # Another customer can't even see that the ticket exists -> 404, not 403
    res = client_for(other_customer).get(f"/api/tickets/{ticket.id}/comments/")
    assert res.status_code == 404


def test_filter_by_status(admin, customer):
    Ticket.objects.create(title="A", description="x", created_by=customer, status="open")
    Ticket.objects.create(title="B", description="y", created_by=customer, status="closed")

    res = client_for(admin).get("/api/tickets/?status=closed")
    assert res.data["count"] == 1

def test_ticket_creation_sends_email(customer):
    client_for(customer).post(
        "/api/tickets/",
        {"title": "Cannot login", "description": "Error 500"},
        format="json",
    )
    # Django's test runner collects sent emails in mail.outbox
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [customer.email]

def test_ai_reply_is_saved_on_ticket(customer, settings, monkeypatch):
    settings.GROQ_API_KEY = "test-key"

    # A fake response object, so no real network call happens
    class FakeResponse:
        status_code = 200  # the task checks this before calling raise_for_status
        text = ""

        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": "Hi, please try resetting your password."}}]}

    monkeypatch.setattr("tickets.tasks.requests.post", lambda *a, **k: FakeResponse())

    ticket = Ticket.objects.create(title="Cannot login", description="x", created_by=customer)
    generate_ai_reply(ticket.id)

    ticket.refresh_from_db()
    assert ticket.ai_suggested_reply.startswith("Hi, please try")

def test_ai_reply_skipped_without_api_key(customer):
    ticket = Ticket.objects.create(title="A", description="x", created_by=customer)
    generate_ai_reply(ticket.id)  # key is "" in tests, so this must do nothing and not crash
    ticket.refresh_from_db()
    assert ticket.ai_suggested_reply == ""


def test_customer_cannot_see_ai_draft_but_agent_can(customer, agent):
    ticket = Ticket.objects.create(
        title="A", description="x", created_by=customer, assigned_to=agent,
        ai_suggested_reply="Draft reply",
    )
    res = client_for(customer).get(f"/api/tickets/{ticket.id}/")
    assert "ai_suggested_reply" not in res.data

    res = client_for(agent).get(f"/api/tickets/{ticket.id}/")
    assert res.data["ai_suggested_reply"] == "Draft reply"

def test_only_admin_can_list_agents(customer, agent, admin):
    assert client_for(customer).get("/api/auth/agents/").status_code == 403
    assert client_for(agent).get("/api/auth/agents/").status_code == 403

    res = client_for(admin).get("/api/auth/agents/")
    assert res.status_code == 200
    assert [a["username"] for a in res.data] == ["agent1"]