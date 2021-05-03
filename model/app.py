#!/usr/bin/env python3
import secrets
import time
from signal import SIGTERM, signal

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import BadRequest, HTTPException

from model import Model
from utils import jwtHS256


app = Flask(__name__)
app.secret_key = secrets.token_bytes(32)
model = Model()


def process_playlist(playlist, **kwargs):
    global model
    tracks = playlist["tracks"]
    if not isinstance(tracks, list):
        raise BadRequest("invalid 'tracks': not an array")
    id_ = playlist.get("id")
    return model.process_playlist(tracks, id_, **kwargs)


def sanity_check():
    return process_playlist(
        {
            "tracks": [
                {"artists": ["La Sonora Matancera", "Nelson Pinedo"]},
                {"artists": ["Bette Midler"]},
                {"artists": ["Cesária Evora"]},
            ]
        },
        update=False,
        recommend=False,
    )


@app.before_first_request
def init():
    global model
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
    global model
    body = request.get_json()
    update = request.args.get("update") != "0"
    recommend = request.args.get("recommend") != "0"
    autosave = request.args.get("autosave") != "0"
    res = process_playlist(body, update=update, recommend=recommend)
    if update and autosave:
        # TODO: limit the number of times we save; once per hour?
        model.save_async()
    return res


@app.route("/save", methods=["POST"])
def save():
    global model
    model.save_async()
    return "", 204


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


# @app.before_request
# def require_csrftoken():
#     if request.endpoint == "csrftoken":
#         return
#     token = request.headers["x-csrftoken"]


def signal_handler(signal_received, frame):
    global model
    # SIGTERM detected; save and exit without error
    model.save()
    exit(0)


if __name__ == "__main__":
    signal(SIGTERM, signal_handler)
    app.run()
