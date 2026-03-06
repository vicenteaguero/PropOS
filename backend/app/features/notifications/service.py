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
    client = get_supabase_client()
    result = (
        client.table("notification_subscriptions")
        .insert(
            {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "endpoint": endpoint,
                "p256dh": p256dh,
                "auth_key": auth_key,
            }
        )
        .execute()
    )
    return result.data[0] if result.data else {}


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
) -> int:
    subscriptions = await get_subscriptions(tenant_id, user_id)
    sent = 0
    payload = f'{{"title": "{title}", "body": "{body}", "icon": "/pwa-192x192.png"}}'

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
            logger.warning(
                "Push failed",
                event_type="push_failed",
                endpoint=sub["endpoint"],
                error=str(e),
            )
    return sent
