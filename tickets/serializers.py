from rest_framework import serializers

from accounts.models import User

from .models import Comment, Ticket


class CommentSerializer(serializers.ModelSerializer):
    # Show the author's username text instead of just an id number.
    # read_only=True means clients can't send this field; we set it ourselves in the view.
    author = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "author", "body", "created_at")
        read_only_fields = ("id", "author", "created_at")


class TicketSerializer(serializers.ModelSerializer):
    """Used to READ tickets and to UPDATE them (staff only)."""

    created_by = serializers.StringRelatedField(read_only=True)
    assigned_to = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Ticket
        fields = (
            "id", "title", "description", "status", "priority",
            "created_by", "assigned_to", "ai_suggested_reply",
            "created_at", "updated_at",
        )
        # These can be seen but never changed through an update request.
        read_only_fields = (
            "id", "created_by", "assigned_to", "ai_suggested_reply",
            "created_at", "updated_at",
        )

    # NEW: runs every time a ticket is converted to JSON for a response.
    def to_representation(self, instance):
        # Build the normal output first (a dict of all the fields above)
        data = super().to_representation(instance)

        # The serializer gets the current request through "context".
        # DRF's viewsets pass it automatically; in the assign action we pass it by hand.
        request = self.context.get("request")
        user = getattr(request, "user", None)

        # Drafts are for staff only (admins and agents).
        # If there is no request, or the user is not logged in, is_staff stays False,
        # so the draft is hidden. Hiding by default is the safe choice.
        is_staff = bool(
            user
            and user.is_authenticated
            and (user.is_admin_role or user.is_agent_role)
        )
        if not is_staff:
            # pop removes the key; the None default stops a crash if it's missing
            data.pop("ai_suggested_reply", None)

        return data


class TicketCreateSerializer(serializers.ModelSerializer):
    """Used only when OPENING a ticket. A customer can set only these 3 fields,
    so they can't create a ticket that is already 'closed' or pre-assigned."""

    class Meta:
        model = Ticket
        fields = ("id", "title", "description", "priority")
        read_only_fields = ("id",)


class AssignSerializer(serializers.Serializer):
    # The client sends {"agent_id": 2}. The queryset restricts valid ids to users
    # whose role is 'agent', so you can't assign a ticket to a customer.
    # source="agent" means the validated value is available as validated_data["agent"].
    agent_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.AGENT), source="agent"
    )