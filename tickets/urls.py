from rest_framework.routers import DefaultRouter

from .views import TicketViewSet

# The router builds all the URLs from the viewset automatically:
# /api/tickets/, /api/tickets/{id}/, /api/tickets/{id}/assign/, /api/tickets/{id}/comments/
router = DefaultRouter()
router.register("", TicketViewSet, basename="ticket")

urlpatterns = router.urls