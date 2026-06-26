from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "src" / "backend"
TEMP_CERTS_DIR = ROOT / ".openapi-certs"


def ensure_export_keys() -> tuple[Path, Path]:
    private_key_path = TEMP_CERTS_DIR / "jwt-private.pem"
    public_key_path = TEMP_CERTS_DIR / "jwt-public.pem"

    if private_key_path.exists() and public_key_path.exists():
        return private_key_path, public_key_path

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    TEMP_CERTS_DIR.mkdir(parents=True, exist_ok=True)
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_key_path.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ),
    )
    public_key_path.write_bytes(
        private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ),
    )
    return private_key_path, public_key_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Export FastAPI OpenAPI schema.")
    parser.add_argument(
        "--output",
        default=str(ROOT / "openapi" / "foodize.openapi.json"),
        help="Path to write the OpenAPI JSON schema.",
    )
    args = parser.parse_args()

    sys.path.insert(0, str(BACKEND_DIR))
    os.environ.setdefault(
        "DB__URL",
        "postgresql+asyncpg://foodize:foodize@localhost:5432/foodize",
    )
    private_key_path, public_key_path = ensure_export_keys()
    os.environ.setdefault("AUTH__PRIVATE_KEY_PATH", str(private_key_path))
    os.environ.setdefault("AUTH__PUBLIC_KEY_PATH", str(public_key_path))

    from main import app

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"OpenAPI schema exported to {output_path}")


if __name__ == "__main__":
    main()
