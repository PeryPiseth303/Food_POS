import logging
import secrets
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone, timedelta
from typing import Tuple
import anyio
from app.core.config import settings

logger = logging.getLogger("email_service")


def generate_otp_code() -> str:
    """Generate a secure 6-digit numeric OTP code."""
    return f"{secrets.randbelow(900000) + 100000}"


def get_otp_expiry() -> datetime:
    """Return timezone-aware expiry datetime for an OTP."""
    return datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)


def _send_smtp_email_sync(to_email: str, subject: str, text_body: str, html_body: str) -> bool:
    """Synchronous SMTP worker called via anyio thread pool."""
    if not settings.SMTP_HOST:
        return False

    try:
        msg = MIMEMultipart("alternative")
        from_name = settings.SMTP_FROM_NAME
        from_addr = settings.SMTP_FROM_EMAIL
        msg["From"] = f"{from_name} <{from_addr}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        part_text = MIMEText(text_body, "plain", "utf-8")
        part_html = MIMEText(html_body, "html", "utf-8")
        msg.attach(part_text)
        msg.attach(part_html)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Verification email successfully sent to {to_email} via SMTP.")
        return True
    except Exception as e:
        logger.error(f"Failed to send email via SMTP ({settings.SMTP_HOST}:{settings.SMTP_PORT}): {e}")
        return False


async def send_otp_email(to_email: str, otp_code: str, customer_name: str = "") -> Tuple[bool, str]:
    """
    Sends a 6-digit verification code to the customer's email.
    If SMTP server is configured in settings, it dispatches the actual email.
    Always logs the OTP to console and returns the OTP code for local/dev support.
    """
    subject = f"Your {settings.RESTAURANT_NAME} Verification Code: {otp_code}"
    greeting_name = customer_name.strip() if customer_name else "Food Lover"

    text_body = (
        f"Hello {greeting_name},\n\n"
        f"Thank you for joining {settings.RESTAURANT_NAME}!\n\n"
        f"Your verification code is:\n"
        f"{otp_code}\n\n"
        f"This code will expire in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
        f"If you did not request this verification, please ignore this message.\n\n"
        f"— {settings.RESTAURANT_NAME} Team"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Verification</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">{settings.RESTAURANT_NAME}</h1>
              <p style="color: #fed7aa; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">Online Food Ordering & Delivery</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Verify Your Email Address</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Hello <strong>{greeting_name}</strong>,
                <br>
                Thank you for creating an account. Please enter the verification code below to verify your email and activate your account:
              </p>

              <!-- OTP Code Display Card -->
              <div style="background-color: #fff7ed; border: 2px dashed #f97316; border-radius: 14px; padding: 20px; text-align: center; margin: 24px 0;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #ea580c; letter-spacing: 1px; margin-bottom: 6px;">One-Time Verification Code</div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #c2410c; margin: 4px 0;">
                  {otp_code}
                </div>
                <div style="font-size: 12px; color: #9a3412; margin-top: 6px; font-weight: 500;">
                  ⏱️ Valid for {settings.OTP_EXPIRE_MINUTES} minutes
                </div>
              </div>

              <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin: 0 0 8px 0;">
                If you did not request this verification, you can safely ignore this email. Someone may have entered your email address by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 12px; color: #64748b; margin: 0;">
                &copy; 2026 {settings.RESTAURANT_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    # Always log clearly to console for instant visibility during development & testing
    print("\n" + "=" * 65)
    print(f"[EMAIL OTP DISPATCHED]")
    print(f"To: {to_email} ({greeting_name})")
    print(f"Verification Code: {otp_code}")
    print(f"Expires in: {settings.OTP_EXPIRE_MINUTES} minutes")
    print(f"SMTP Configured: {'Yes (' + settings.SMTP_HOST + ')' if settings.SMTP_HOST else 'No (Development Mock Mode)'}")
    print("=" * 65 + "\n")

    smtp_sent = False
    if settings.SMTP_HOST:
        try:
            smtp_sent = await anyio.to_thread.run_sync(
                _send_smtp_email_sync, to_email, subject, text_body, html_body
            )
        except Exception as e:
            logger.error(f"Error dispatching OTP email: {e}")

    return smtp_sent, otp_code
