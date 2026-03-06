from pydantic import BaseModel


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth_key: str


class SendNotificationRequest(BaseModel):
    title: str = "PropOS"
    body: str
    user_id: str | None = None  # None = broadcast to all in tenant
