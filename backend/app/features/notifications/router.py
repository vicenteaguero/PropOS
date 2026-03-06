from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, get_tenant_id, require_role
from app.features.notifications.schemas import PushSubscriptionCreate, SendNotificationRequest
from app.features.notifications import service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/subscribe", dependencies=[Depends(require_role("ADMIN", "MANAGER", "AGENT", "VIEWER"))])
async def subscribe(
    payload: PushSubscriptionCreate,
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> dict:
    result = await service.save_subscription(
        user_id=user["id"],
        tenant_id=tenant_id,
        endpoint=payload.endpoint,
        p256dh=payload.p256dh,
        auth_key=payload.auth_key,
    )
    return {"status": "subscribed", "data": result}


@router.post("/send", dependencies=[Depends(require_role("ADMIN", "MANAGER"))])
async def send_notification(
    payload: SendNotificationRequest,
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> dict:
    sent = await service.send_push(
        tenant_id=tenant_id,
        title=payload.title,
        body=payload.body,
        user_id=payload.user_id,
    )
    return {"status": "sent", "count": sent}
