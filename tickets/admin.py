from django.contrib import admin

from .models import Comment, Ticket

admin.site.register(Ticket)
admin.site.register(Comment)