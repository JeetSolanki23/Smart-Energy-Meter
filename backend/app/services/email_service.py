from datetime import UTC, datetime
from email.message import EmailMessage
import smtplib
from typing import Iterable

import structlog
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.bill import Bill
from app.models.device import Device
from app.models.user import User

settings = get_settings()
logger = structlog.get_logger(__name__)


class EmailService:
    def __init__(self) -> None:
        self.enabled = settings.SMTP_ENABLED

    def _is_configured(self) -> bool:
        return bool(self.enabled and settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)

    def send_email(self, recipients: Iterable[str], subject: str, body: str, html_body: str | None = None) -> bool:
        recipient_list = [r.strip() for r in recipients if r and r.strip()]
        if not recipient_list:
            return False

        if not self._is_configured():
            logger.info("email.skipped_not_configured", subject=subject, recipients=recipient_list)
            return False

        msg = EmailMessage()
        msg["From"] = (
            f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
            if settings.SMTP_FROM_NAME
            else settings.SMTP_FROM_EMAIL
        )
        msg["To"] = ", ".join(recipient_list)
        msg["Subject"] = subject
        msg.set_content(body)
        if html_body:
            msg.add_alternative(html_body, subtype="html")

        try:
            if settings.SMTP_USE_SSL:
                with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT_SECONDS) as server:
                    if settings.SMTP_USERNAME:
                        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT_SECONDS) as server:
                    if settings.SMTP_USE_TLS:
                        server.starttls()
                    if settings.SMTP_USERNAME:
                        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                    server.send_message(msg)
            logger.info("email.sent", subject=subject, recipients=recipient_list)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.exception("email.send_failed", subject=subject, recipients=recipient_list, error=str(exc))
            return False


email_service = EmailService()


def _dedupe_recipients(emails: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for email in emails:
        e = (email or "").strip()
        if not e:
            continue
        key = e.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(e)
    return result


def _recipients_owner_plus_admin(owner_email: str | None) -> list[str]:
    recipients = [owner_email] if owner_email else []
    recipients.extend(settings.alert_email_recipients)
    return _dedupe_recipients(recipients)


def _recipients_owner_only(owner_email: str | None) -> list[str]:
    return _dedupe_recipients([owner_email] if owner_email else [])


def _brand_html(title: str, subtitle: str, rows: list[tuple[str, str]], footer: str) -> str:
    row_html = "".join(
        f"<tr><td style='padding:8px 0;color:#64748b;font-size:13px'>{k}</td>"
        f"<td style='padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right'>{v}</td></tr>"
        for k, v in rows
    )
    return f"""
<html>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
            <tr>
                <td align="center">
                    <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
                        <tr>
                            <td style="padding:18px 22px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#fff;">
                                <div style="font-size:12px;letter-spacing:.08em;opacity:.85;text-transform:uppercase;">Smart Energy Meter</div>
                                <div style="margin-top:6px;font-size:22px;font-weight:700;line-height:1.3;">{title}</div>
                                <div style="margin-top:6px;font-size:13px;opacity:.92;">{subtitle}</div>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:20px 22px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">{row_html}</table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:14px 22px;background:#f8fafc;color:#475569;font-size:12px;line-height:1.5;">
                                {footer}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>
""".strip()


def send_tamper_notification(db: Session, device: Device) -> None:
    user = db.query(User).filter(User.id == device.user_id).first() if device.user_id else None

    recipients = _recipients_owner_plus_admin(user.email if user else None)

    if not recipients:
        return

    detected_at = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
    subject = f"[SmartMeter] Tamper Detected - {device.device_id}"
    body = (
        "Tamper activity was detected on your smart meter.\n\n"
        f"Device ID: {device.device_id}\n"
        f"Location: {device.location}\n"
        f"Detected At: {detected_at}\n"
        "Device status has been changed to DEACTIVATED and relay turned OFF for safety.\n"
        "Please contact support/admin for recovery."
    )

    html = _brand_html(
        title="Tamper Detected",
        subtitle="Protective actions were applied automatically for safety.",
        rows=[
            ("Device ID", device.device_id),
            ("Location", device.location),
            ("Detected At", detected_at),
            ("Action", "Device deactivated, relay OFF"),
        ],
        footer="If this was unexpected, please inspect the meter and contact admin/support.",
    )

    email_service.send_email(recipients, subject, body, html_body=html)


def send_payment_success_notification(db: Session, bill: Bill) -> None:
    user = db.query(User).filter(User.id == bill.user_id).first()
    if not user or not user.email:
        return

    recipients = _recipients_owner_only(user.email)
    if not recipients:
        return

    subject = f"[SmartMeter] Payment Received - {bill.month.strftime('%B %Y')}"
    body = (
        "Your bill payment was successful.\n\n"
        f"Billing Month: {bill.month.strftime('%B %Y')}\n"
        f"Units: {bill.units:.4f} kWh\n"
        f"Amount Paid: Rs {bill.amount:.2f}\n"
        f"Due Date: {bill.due_date.isoformat()}\n"
        "\nThank you for your payment."
    )

    html = _brand_html(
        title="Payment Successful",
        subtitle="Your payment was received and the bill is now marked as paid.",
        rows=[
            ("Billing Month", bill.month.strftime("%B %Y")),
            ("Units", f"{bill.units:.4f} kWh"),
            ("Amount Paid", f"Rs {bill.amount:.2f}"),
            ("Due Date", bill.due_date.isoformat()),
            ("Status", "PAID"),
        ],
        footer="This is an automated confirmation from Smart Energy Meter.",
    )

    email_service.send_email(recipients, subject, body, html_body=html)


def send_bill_generated_notification(db: Session, bill: Bill) -> None:
    user = db.query(User).filter(User.id == bill.user_id).first()
    if not user or not user.email:
        return

    recipients = _recipients_owner_only(user.email)
    if not recipients:
        return

    subject = f"[SmartMeter] New Bill Generated - {bill.month.strftime('%B %Y')}"
    body = (
        "A new monthly bill has been generated.\n\n"
        f"Billing Month: {bill.month.strftime('%B %Y')}\n"
        f"Units: {bill.units:.4f} kWh\n"
        f"Amount Due: Rs {bill.amount:.2f}\n"
        f"Due Date: {bill.due_date.isoformat()}\n"
        "Status: UNPAID\n"
        "\nPlease complete payment before the due date."
    )

    html = _brand_html(
        title="New Bill Generated",
        subtitle="Your monthly energy bill is ready.",
        rows=[
            ("Billing Month", bill.month.strftime("%B %Y")),
            ("Units", f"{bill.units:.4f} kWh"),
            ("Amount Due", f"Rs {bill.amount:.2f}"),
            ("Due Date", bill.due_date.isoformat()),
            ("Status", "UNPAID"),
        ],
        footer="Pay on time to avoid overdue status.",
    )

    email_service.send_email(recipients, subject, body, html_body=html)


def send_test_notification(admin_email: str | None) -> dict:
    recipients = _recipients_owner_plus_admin(admin_email)
    if not recipients:
        return {"sent": False, "recipients": [], "reason": "No recipients configured"}

    now_text = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
    subject = "[SmartMeter] Test Notification"
    body = (
        "This is a test email from Smart Energy Meter.\n\n"
        f"Triggered At: {now_text}\n"
        f"Triggered By: {admin_email or 'admin'}\n"
        "If you received this, SMTP configuration is working."
    )
    html = _brand_html(
        title="Test Notification",
        subtitle="SMTP setup is working correctly.",
        rows=[
            ("Triggered At", now_text),
            ("Triggered By", admin_email or "admin"),
            ("SMTP Host", settings.SMTP_HOST or "(not set)"),
            ("TLS", "ON" if settings.SMTP_USE_TLS else "OFF"),
        ],
        footer="You can safely ignore this message.",
    )

    sent = email_service.send_email(recipients, subject, body, html_body=html)
    return {"sent": sent, "recipients": recipients}
