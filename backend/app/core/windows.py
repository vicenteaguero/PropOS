"""Messaging windows, named once.

WhatsApp's free-form reply window is the clock two unrelated features run on —
the attention queue's urgency (`attention/service.py`) and a proposal's
deadline (`agent/tools/executors.py`) — and it was a private constant in the
first of them. Two copies of a number that Meta, not us, decides is two chances
to drift.
"""

#: Hours after a contact's last inbound message during which we may reply with
#: free-form text. Past it, only an approved template is delivered.
FREEFORM_HOURS = 24
