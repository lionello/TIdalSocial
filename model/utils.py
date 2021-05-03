# -*- coding: utf-8 -*-
import base64
import hmac
import json


def base64url(str_or_bytes):
    if isinstance(str_or_bytes, str):
        str_or_bytes = str_or_bytes.encode("utf-8")
    return base64.urlsafe_b64encode(str_or_bytes).rstrip(b"=")


assert base64url("ö") == b"w7Y"

COMPACT_SEPARATORS = (",", ":")


def jwtHS256(payload, secret_key, jose={}):
    jose = {"typ": "JWT", **jose, "alg": "HS256"}
    jose = base64url(json.dumps(jose, separators=COMPACT_SEPARATORS))
    if not isinstance(payload, bytes):
        payload = json.dumps(payload, separators=COMPACT_SEPARATORS)
    jwt = jose + b"." + base64url(payload)
    sig = hmac.digest(secret_key, jwt, "SHA256")
    return jwt + b"." + base64url(sig)


assert (
    jwtHS256(0, b"asdf")
    == b"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.MA.2dy1KBMg0xLfOGeFxww_NmQUWvigXSLeBkk_rp6Y_jE"
)
