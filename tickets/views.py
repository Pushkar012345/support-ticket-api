from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .tasks import generate_ai_reply, send_ticket_created_email
from accounts.permissions import IsAdminRole, IsStaffRole

from .models import Ticket
from .serializers import (
    AssignSerializer,
    CommentSerializer,
    TicketCreateSerializer,
    TicketSerializer,
)


class TicketViewSet(viewsets.ModelViewSet):
    """
    customer -> sees/creates only own tickets, can comment
    agent    -> sees tickets assigned to them, can update status/priority, can comment
    admin    -> sees everything, can assign and delete
    """

        # Fields that can be used as exact filters: ?status=open&priority=high&assigned_to=2
    filterset_fields = ["status", "priority", "assigned_to"]

    # Fields searched by ?search=word (case-insensitive "contains" match)
    search_fields = ["title", "description"]

    # Fields that can be sorted with ?ordering=field (or -field for descending)
    ordering_fields = ["created_at", "priority", "status"]
   
    def get_queryset(self):
        # drf-spectacular calls this while building the Swagger docs, with no real user.
        # Return an empty queryset so it can read the model without crashing.
        if getattr(self, "swagger_fake_view", False):
            return Ticket.objects.none()

        user = self.request.user
        qs = Ticket.objects.select_related("created_by", "assigned_to")
        # ...the rest stays exactly the same...

        if user.is_admin_role:
            return qs                         # admin: everything
        if user.is_agent_role:
            return qs.filter(assigned_to=user)  # agent: only assigned to them
        return qs.filter(created_by=user)       # customer: only their own

    # Pick the serializer based on what the request is doing
    def get_serializer_class(self):
        if self.action == "create":
            return TicketCreateSerializer
        if self.action == "assign":
            return AssignSerializer
        return TicketSerializer

    # LAYER 1 (are you allowed to call this endpoint at all?)
    def get_permissions(self):
        if self.action in ("update", "partial_update"):
            return [IsStaffRole()]   # only agents and admins can change tickets
        if self.action in ("destroy", "assign"):
            return [IsAdminRole()]   # only admins can delete or assign
        return [IsAuthenticated()]   # list, retrieve, create, comments: any logged-in user

    def perform_create(self, serializer):
        ticket = serializer.save(created_by=self.request.user)
        send_ticket_created_email.delay(ticket.id)
        generate_ai_reply.delay(ticket.id)  # the AI call happens in the worker, not here

    # Custom endpoint: POST /api/tickets/{id}/assign/
    @extend_schema(request=AssignSerializer, responses=TicketSerializer)
    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        ticket = self.get_object()  # 404 if this ticket isn't visible to the user
        serializer = AssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)  # auto-returns 400 on bad input

        ticket.assigned_to = serializer.validated_data["agent"]
        if ticket.status == Ticket.Status.OPEN:
            ticket.status = Ticket.Status.IN_PROGRESS  # picking it up starts the work
        ticket.save()
        return Response(TicketSerializer(ticket, context={"request": request}).data)

    # Custom endpoint: GET and POST /api/tickets/{id}/comments/
    @extend_schema(request=CommentSerializer, responses=CommentSerializer(many=True))
    @action(detail=True, methods=["get", "post"])
    def comments(self, request, pk=None):
        ticket = self.get_object()  # same visibility rule: you can only comment on tickets you can see

        if request.method == "GET":
            comments = ticket.comments.select_related("author")
            return Response(CommentSerializer(comments, many=True).data)

        serializer = CommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(ticket=ticket, author=request.user)  # author comes from the token
        return Response(serializer.data, status=status.HTTP_201_CREATED)