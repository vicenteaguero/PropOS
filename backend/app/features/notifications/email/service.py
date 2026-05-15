"""High-level email service. Calls templates + Resend client."""

from __future__ import annotations

from app.features.notifications.email import templates
from app.features.notifications.email.client import send_email


async def send_invitation(*, to: str, full_name: str, invite_url: str) -> str:
    subject, html = templates.invitation(full_name=full_name, invite_url=invite_url)
    return await send_email(to=to, subject=subject, html=html)


async def send_recovery(*, to: str, full_name: str, recovery_url: str) -> str:
    subject, html = templates.recovery(full_name=full_name, recovery_url=recovery_url)
    return await send_email(to=to, subject=subject, html=html)


async def send_email_change(*, to: str, full_name: str, confirm_url: str, new_email: str) -> str:
    subject, html = templates.email_change(full_name=full_name, confirm_url=confirm_url, new_email=new_email)
    return await send_email(to=to, subject=subject, html=html)


async def send_visitor_invitation(*, to: str, invite_url: str, property_title: str, brand: str) -> str:
    """Plan v4: visitor registration link via Resend custom (NOT Supabase auth flow)."""
    subject, html = templates.visitor_invitation(
        invite_url=invite_url, property_title=property_title, brand=brand
    )
    return await send_email(to=to, subject=subject, html=html)


async def send_visitor_existing_login(*, to: str, login_url: str, reset_url: str, brand: str) -> str:
    subject, html = templates.visitor_existing_login(
        login_url=login_url, reset_url=reset_url, brand=brand
    )
    return await send_email(to=to, subject=subject, html=html)
