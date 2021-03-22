#!/usr/bin/env python3
import base64
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from urllib.parse import urlparse

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import BadRequest, HTTPException

from model import Model


def base64url(str_or_bytes):
    if isinstance(str_or_bytes, str):
        str_or_bytes = str_or_bytes.encode("utf-8")
    return base64.urlsafe_b64encode(str_or_bytes).rstrip(b"=")


assert base64url("ö") == b"w7Y"

COMPACT_SEPARATORS = (",", ":")
CACHE_DIR = Path(__file__).absolute().parent.parent / "db" / "playlist"


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


def load_json(filename):
    with open(filename, "r") as infile:
        return json.load(infile)


def save_json(filename, obj):
    with open(filename, "w") as outfile:
        json.dump(obj, outfile)


def sanity_check():
    return process_playlist(
        load_json(CACHE_DIR / "5e76c6c2-ed06-4126-8d7f-a0bd6a9a091d-playlist.json"),
        update=False,
        recommend=False,
    )


def reset_playlists():
    model.reset()
    for f in os.listdir(CACHE_DIR):
        if f[-5:] == ".json":
            print("Loading", f)
            playlist = load_json(CACHE_DIR / f)
            try:
                print(process_playlist(playlist, recommend=False))
            except BadRequest as err:
                print(str(err))


app = Flask(__name__)
app.secret_key = secrets.token_bytes(32)
model = Model()


def process_playlist(playlist, **kwargs):
    url = playlist["url"]
    if urlparse(url).scheme != "https":
        raise BadRequest("invalid 'url': not a valid URL")
    tracks = playlist["tracks"]
    if not isinstance(tracks, list):
        raise BadRequest("invalid 'tracks': not an array")
    return model.process_playlist(url, tracks, **kwargs)


@app.before_first_request
def init():
    model.load()
    print(sanity_check())


@app.route("/csrftoken", methods=["POST"])
def csrftoken():
    now = int(time.time())
    return jwtHS256({"iat": now, "exp": now + 600}, app.secret_key)


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/playlist", methods=["POST"])
def playlist():
    body = request.get_json()
    update = request.args.get("update") != "0"
    recommend = request.args.get("recommend") != "0"
    return process_playlist(body, update=update, recommend=recommend)


@app.errorhandler(Exception)
def handle_error(error):
    code = 500
    if isinstance(error, HTTPException):
        code = error.code
    return jsonify(error=str(error)), code


@app.route("/js/<filename>")
def parsejs(filename):
    # FIXME: ensure filename starts with parse.js
    return send_from_directory("../dist", filename)


@app.before_request
def require_csrftoken():
    if request.endpoint == "csrftoken":
        return
    # token = request.headers["x-csrftoken"]


if __name__ == "__main__":
    app.run(debug=True)
