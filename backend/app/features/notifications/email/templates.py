"""HTML email templates. Dark-themed, Spanish UI.

All Supabase Auth flows (invite/recovery/email_change) are also configured
identically in the Supabase Dashboard's Email Templates UI; these versions
are used for backend-initiated mail (custom welcome flows, etc.).
"""

from __future__ import annotations

_BODY_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
_BODY_STYLE = f"margin:0;padding:0;background:#0a0a0a;color:#e5e5e5;font-family:{_BODY_FONT};"
_OUTER_TBL = "background:#0a0a0a;padding:40px 16px;"
_CARD_STYLE = "max-width:560px;background:#141414;border:1px solid #262626;border-radius:12px;overflow:hidden;"

_BASE = (
    "<!doctype html>\n"
    '<html lang="es"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    "<title>{title}</title></head>"
    f'<body style="{_BODY_STYLE}">'
    f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="{_OUTER_TBL}">'
    '<tr><td align="center">'
    f'<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="{_CARD_STYLE}">'
    '<tr><td style="padding:32px 32px 8px;">'
    '<div style="font-size:13px;letter-spacing:0.12em;color:#a3a3a3;text-transform:uppercase;">PropOS</div>'
    "</td></tr>"
    '<tr><td style="padding:8px 32px 24px;">'
    '<h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#fafafa;line-height:1.3;">{heading}</h1>'
    "{body}"
    "</td></tr>"
    '<tr><td style="padding:0 32px 32px;">'
    '<div style="font-size:12px;color:#737373;line-height:1.5;border-top:1px solid #262626;padding-top:16px;">'
    "Este correo fue enviado automáticamente por PropOS. Si no esperabas recibirlo, podés ignorarlo."
    "</div></td></tr></table></td></tr></table></body></html>"
)


def _button(url: str, label: str) -> str:
    return (
        f'<a href="{url}" style="display:inline-block;background:#fafafa;color:#0a0a0a;'
        f"text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;"
        f'font-size:14px;margin:16px 0;">{label}</a>'
    )


def invitation(*, full_name: str, invite_url: str) -> tuple[str, str]:
    """Returns (subject, html) for the magic-invite email."""
    name = full_name.strip() or "Hola"
    body = f"""
        <p style="margin:0 0 12px;color:#d4d4d4;line-height:1.6;font-size:15px;">
          {name}, te invitaron a unirte a PropOS.
        </p>
        <p style="margin:0 0 16px;color:#d4d4d4;line-height:1.6;font-size:15px;">
          Hacé click en el botón para crear tu contraseña y entrar al panel.
        </p>
        {_button(invite_url, "Activar cuenta")}
        <p style="margin:16px 0 0;color:#737373;line-height:1.5;font-size:13px;">
          El link es de un solo uso y vence en 24 horas.
        </p>
    """
    html = _BASE.format(title="Invitación a PropOS", heading="Te dieron acceso a PropOS", body=body)
    return ("Tu invitación a PropOS", html)


def recovery(*, full_name: str, recovery_url: str) -> tuple[str, str]:
    name = full_name.strip() or "Hola"
    body = f"""
        <p style="margin:0 0 12px;color:#d4d4d4;line-height:1.6;font-size:15px;">
          {name}, recibimos un pedido para restablecer tu contraseña.
        </p>
        {_button(recovery_url, "Restablecer contraseña")}
        <p style="margin:16px 0 0;color:#737373;line-height:1.5;font-size:13px;">
          Si no fuiste vos, ignorá este mensaje. Tu contraseña actual sigue activa.
        </p>
    """
    html = _BASE.format(title="Restablecer contraseña", heading="Restablecé tu contraseña", body=body)
    return ("Restablecer tu contraseña en PropOS", html)


def visitor_invitation(*, invite_url: str, property_title: str, brand: str) -> tuple[str, str]:
    """Plan v4: invitation email sent to a visitor with a registration link."""
    body = f"""
        <p style="margin:0 0 12px;color:#d4d4d4;line-height:1.6;font-size:15px;">
          Te invitamos a registrarte para gestionar tu visita a
          <strong style="color:#fafafa;">{property_title}</strong>.
        </p>
        <p style="margin:0 0 16px;color:#d4d4d4;line-height:1.6;font-size:15px;">
          Toma menos de 2 minutos. Necesitarás escanear tu cédula con el botón del formulario.
        </p>
        {_button(invite_url, "Registrarme")}
        <p style="margin:16px 0 0;color:#737373;line-height:1.5;font-size:13px;">
          El link expira en 7 días.
        </p>
    """
    html = _BASE.format(
        title=f"{brand} — Registro de visita",
        heading=f"{brand}: registro de visita",
        body=body,
    )
    return (f"{brand}: te invitamos a registrarte para visitar {property_title}", html)


def visitor_existing_login(*, login_url: str, reset_url: str, brand: str) -> tuple[str, str]:
    """Plan v4: informative email when admin invites someone with an existing account."""
    body = f"""
        <p style="margin:0 0 12px;color:#d4d4d4;line-height:1.6;font-size:15px;">
          Tienes una cuenta previa con nosotros. Para vincular esta nueva propiedad
          a tu perfil, ingresá con tu contraseña.
        </p>
        {_button(login_url, "Ingresar")}
        <p style="margin:16px 0 0;color:#737373;line-height:1.5;font-size:13px;">
          ¿Olvidaste tu contraseña? <a href="{reset_url}" style="color:#fafafa;">Restablecela acá</a>.
        </p>
    """
    html = _BASE.format(
        title=f"{brand} — Ingresa a tu cuenta",
        heading=f"{brand}: ingresa a tu cuenta",
        body=body,
    )
    return (f"{brand}: ingresa a tu cuenta para vincular tu nueva visita", html)


def email_change(*, full_name: str, confirm_url: str, new_email: str) -> tuple[str, str]:
    name = full_name.strip() or "Hola"
    body = f"""
        <p style="margin:0 0 12px;color:#d4d4d4;line-height:1.6;font-size:15px;">
          {name}, pediste cambiar tu correo a <strong style="color:#fafafa;">{new_email}</strong>.
        </p>
        {_button(confirm_url, "Confirmar nuevo correo")}
        <p style="margin:16px 0 0;color:#737373;line-height:1.5;font-size:13px;">
          Si no fuiste vos, ignorá este mensaje.
        </p>
    """
    html = _BASE.format(title="Confirmar nuevo correo", heading="Confirmá tu nuevo correo", body=body)
    return ("Confirmá tu nuevo correo en PropOS", html)
