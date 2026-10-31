from rest_framework import generics, permissions

from .models import User
from .permissions import IsAdminRole
from .serializers import RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class AgentListView(generics.ListAPIView):
    """Admin-only list of agents. The frontend's assign dropdown uses it."""

    serializer_class = UserSerializer
    permission_classes = [IsAdminRole]
    pagination_class = None  # a plain list; there are only a handful of agents
    queryset = User.objects.filter(role=User.Role.AGENT).order_by("username")