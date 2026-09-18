"""
Interactive / CLI test utility for verifying Google (Gmail) SMTP configuration.

Usage:
    python test_smtp.py
    python test_smtp.py recipient@example.com
"""

import os
import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

# Fix Windows console UTF-8 output if available
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Load .env from backend directory
env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k not in os.environ or not os.environ[k]:
                        os.environ[k] = v
    except Exception as e:
        print(f"Note: Could not parse {env_path}: {e}")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "").strip() or SMTP_USER
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Bistro Moderne Food POS")
SMTP_TLS = os.getenv("SMTP_TLS", "true").lower() in ("true", "1", "yes")

def run_smtp_test(recipient_email: str):
    print("=" * 65)
    print("  GOOGLE (GMAIL) SMTP DIAGNOSTIC TEST")
    print("=" * 65)
    print(f"* Target Recipient : {recipient_email}")
    print(f"* SMTP Server      : {SMTP_HOST}:{SMTP_PORT}")
    print(f"* SMTP User        : {SMTP_USER or '(NOT SET in backend/.env)'}")
    print(f"* SMTP Password    : {'*' * len(SMTP_PASSWORD) if SMTP_PASSWORD else '(NOT SET in backend/.env)'}")
    print(f"* Sender From      : {SMTP_FROM_NAME} <{SMTP_FROM_EMAIL or SMTP_USER}>")
    print(f"* TLS Enabled      : {SMTP_TLS}")
    print("-" * 65)

    if not SMTP_USER:
        print("[ERROR] SMTP_USER is empty in backend/.env!")
        print("--> Open backend/.env and set:")
        print("    SMTP_USER=your_google_email@gmail.com")
        return False

    if not SMTP_PASSWORD:
        print("[ERROR] SMTP_PASSWORD is empty in backend/.env!")
        print("--> You must set a 16-character Google App Password in backend/.env:")
        print("    SMTP_PASSWORD=abcd efgh ijkl mnop")
        print("    Get one here: https://myaccount.google.com/apppasswords")
        return False

    # Build test email
    test_code = "849201"
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Test Verification Code: {test_code} - Bistro Moderne"
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL or SMTP_USER}>"
    msg["To"] = recipient_email

    text_content = (
        f"Hello,\n\n"
        f"This is a test verification email from your Food POS system.\n"
        f"Your test OTP code is: {test_code}\n\n"
        f"Google SMTP is functioning properly!\n"
    )

    html_content = f"""<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background: #f8fafc; padding: 24px; color: #1e293b;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding: 24px; text-align: center; color: white;">
      <h2 style="margin: 0; font-size: 22px;">{SMTP_FROM_NAME}</h2>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Google SMTP Connection Verified</p>
    </div>
    <div style="padding: 24px; text-align: center;">
      <p style="font-size: 14px; color: #475569;">Your test 6-digit Google OTP verification code:</p>
      <div style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #ea580c; background: #fff7ed; border: 2px dashed #f97316; border-radius: 12px; padding: 16px; margin: 16px 0;">
        {test_code}
      </div>
      <p style="font-size: 12px; color: #10b981; font-weight: bold;">
        Google (Gmail) SMTP is connected and working successfully!
      </p>
    </div>
  </div>
</body>
</html>"""

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    print("Connecting to Google SMTP server...")
    try:
        if SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15)
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15)
            if SMTP_TLS:
                print("Upgrading connection to TLS (STARTTLS)...")
                server.starttls()

        print(f"Authenticating as '{SMTP_USER}'...")
        server.login(SMTP_USER, SMTP_PASSWORD)
        print("[OK] Authentication successful!")

        print(f"Sending test OTP email to '{recipient_email}'...")
        server.send_message(msg)
        server.quit()

        print("-" * 65)
        print(f"[SUCCESS] Real test OTP email was delivered to '{recipient_email}'.")
        print("Check your inbox (or spam folder) now!")
        print("=" * 65)
        return True

    except smtplib.SMTPAuthenticationError as e:
        print("\n" + "!" * 65)
        print("[ERROR] GOOGLE AUTHENTICATION FAILED (Error 535)!")
        print("-" * 65)
        print(f"Detail: {e}")
        print("\nWhy this happens with Google:")
        print(" Google does NOT allow standard account passwords for third-party SMTP.")
        print(" You MUST generate an 'App Password'.")
        print("\nHow to fix in 2 minutes:")
        print(" 1. Go to your Google Account security settings:")
        print("    --> https://myaccount.google.com/security")
        print(" 2. Turn ON '2-Step Verification' (if not already enabled).")
        print(" 3. Go to App Passwords:")
        print("    --> https://myaccount.google.com/apppasswords")
        print(" 4. Enter 'Food POS' as the App name, click Create.")
        print(" 5. Google will show a 16-letter password like 'abcd efgh ijkl mnop'.")
        print(" 6. Paste it into backend/.env:")
        print("    SMTP_PASSWORD=abcdefghijklmnop")
        print("!" * 65 + "\n")
        return False

    except Exception as e:
        print(f"\n[ERROR] FAILED to send email: {e}")
        return False


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    if not target:
        default_target = SMTP_USER or "your_email@gmail.com"
        print(f"No recipient specified. Testing with: {default_target}")
        target = default_target
    run_smtp_test(target)
