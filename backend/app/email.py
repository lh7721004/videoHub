import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr


SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USERNAME)
SMTP_DISPLAY_NAME = os.getenv("SMTP_DISPLAY_NAME", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() != "false"


def email_enabled() -> bool:
    return bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD and SMTP_FROM)


def send_verification_email(to_email: str, code: str) -> None:
    if not email_enabled():
        raise RuntimeError("Email delivery is not configured")

    message = EmailMessage()
    message["Subject"] = "VideoHub email verification code"
    message["From"] = formataddr((SMTP_DISPLAY_NAME, SMTP_FROM)) if SMTP_DISPLAY_NAME else SMTP_FROM
    message["To"] = to_email
    message.set_content(
        "Use this code to finish creating your VideoHub account.\n\n"
        f"Verification code: {code}\n\n"
        "This code expires in 10 minutes. If you did not request it, ignore this email."
    )
    message.add_alternative(
        f"""
        <!doctype html>
        <html>
          <body style="margin:0;background:#f6f7fb;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111827;">
            <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px rgba(17,24,39,0.10);">
              <div style="background:#111827;padding:28px 28px 24px;">
                <div style="font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#93c5fd;">VideoHub</div>
                <h1 style="margin:12px 0 0;font-size:25px;line-height:1.25;color:#ffffff;">Verify your email</h1>
              </div>
              <div style="padding:30px 28px 32px;">
                <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#4b5563;">
                  Enter the code below to finish creating your VideoHub account.
                </p>
                <div style="margin:26px 0;padding:22px;border-radius:14px;background:#f9fafb;border:1px solid #e5e7eb;text-align:center;">
                  <div style="margin-bottom:8px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">Verification code</div>
                  <div style="font-size:38px;line-height:1;font-weight:800;letter-spacing:0.18em;color:#dc2626;font-family:'SFMono-Regular',Consolas,monospace;">{code}</div>
                </div>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
                  This code expires in 10 minutes. If you did not request this email, you can safely ignore it.
                </p>
              </div>
            </div>
          </body>
        </html>
        """,
        subtype="html",
    )

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
        smtp.ehlo()
        if SMTP_USE_TLS:
            smtp.starttls(context=context)
            smtp.ehlo()
        smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(message)
