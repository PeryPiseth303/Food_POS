import io
import base64
import qrcode
from qrcode.image.styledpil import StyledPilImage
from app.core.config import settings
from app.core.security import create_table_session_token


def generate_table_qr_url(table_id: int, table_number: str, token: str = "") -> str:
    """Returns the customer-facing URL that opens when scanning the QR code."""
    frontend_base = settings.FRONTEND_URL.rstrip("/")
    if not token:
        token = create_table_session_token(table_id, table_number)
    return f"{frontend_base}/menu?table={table_number}&token={token}"


def generate_qr_code_base64(url: str) -> str:
    """Generates a high-contrast, beautiful QR code PNG encoded in Base64."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    img_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_b64}"
