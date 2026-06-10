import json

from pywebpush import webpush, WebPushException

from app.core.config.settings import settings
from app.core.supabase.client import get_supabase_client
from app.core.logging.logger import get_logger

logger = get_logger("NOTIFICATIONS")


async def save_subscription(
    user_id: str,
    tenant_id: str,
    endpoint: str,
    p256dh: str,
    auth_key: str,
) -> dict:
    """Idempotent on endpoint: a device re-subscribes on every load."""
    client = get_supabase_client()
    result = (
        client.table("notification_subscriptions")
        .upsert(
            {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "endpoint": endpoint,
                "p256dh": p256dh,
                "auth_key": auth_key,
            },
            on_conflict="endpoint",
        )
        .execute()
    )
    return result.data[0] if result.data else {}


async def delete_subscription(user_id: str, tenant_id: str, endpoint: str) -> int:
    """Remove a push subscription by endpoint for the current user."""
    client = get_supabase_client()
    result = (
        client.table("notification_subscriptions")
        .delete()
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .eq("endpoint", endpoint)
        .execute()
    )
    return len(result.data or [])


async def get_subscriptions(tenant_id: str, user_id: str | None = None) -> list[dict]:
    client = get_supabase_client()
    query = client.table("notification_subscriptions").select("*").eq("tenant_id", tenant_id)
    if user_id:
        query = query.eq("user_id", user_id)
    result = query.execute()
    return result.data or []


async def send_push(
    tenant_id: str,
    title: str,
    body: str,
    user_id: str | None = None,
    url: str | None = None,
) -> int:
    subscriptions = await get_subscriptions(tenant_id, user_id)
    sent = 0
    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "icon": "/pwa-192x192.png",
            # The service worker deep-links here on notification click.
            "url": url or "/",
        }
    )

    dead_endpoints: list[str] = []
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {
                        "p256dh": sub["p256dh"],
                        "auth": sub["auth_key"],
                    },
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": f"mailto:{settings.vapid_contact_email}"},
            )
            sent += 1
        except WebPushException as e:
            status_code = getattr(getattr(e, "response", None), "status_code", None)
            # 404/410 mean the subscription is permanently gone — prune it so we
            # stop fanning out to dead endpoints.
            if status_code in (404, 410):
                dead_endpoints.append(sub["endpoint"])
            logger.warning(
                "Push failed",
                event_type="push_failed",
                endpoint=sub["endpoint"],
                status_code=status_code,
                error=str(e),
            )

    if dead_endpoints:
        client = get_supabase_client()
        client.table("notification_subscriptions").delete().in_("endpoint", dead_endpoints).execute()

    return sent


async def notify_contact_whatsapp(
    tenant_id: str,
    contact_id: str,
    phone_e164: str,
    template_name: str,
    vars_map: dict[str, str],
    *,
    sender_user_id: str | None = None,
) -> dict:
    """Fan-out helper: push WhatsApp HSM template to a contact.

    Hard-blocks if no opt-in. Caller catches ConsentError to fall back
    to email/PWA push.
    """
    from app.features.notifications.whatsapp.dispatcher import send_template_to_contact

    return await send_template_to_contact(
        tenant_id,
        contact_id,
        phone_e164,
        template_name,
        vars_map,
        sender_user_id=sender_user_id,
    )
