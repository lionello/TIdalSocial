# -*- coding: utf-8 -*-
import json
import logging
import os
import re
import unicodedata

import numpy as np
import scipy
from hnsw_als import HNSWLibAlternatingLeastSquares
from implicit.nearest_neighbours import bm25_weight

ARTISTS_JSON = "artists.json"
PLAYLISTS_JSON = "playlists.json"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORAGE_FOLDER = os.getenv("STORAGE_FOLDER", PROJECT_ROOT)

log = logging.getLogger("model")


# Inspired by https://labrosa.ee.columbia.edu/projects/musicsim/normalization.html
ARTIST_SUBSTITUTIONS = [
    (r"^\s*the\s+", ""),
    (r"^\s*an?\s+", ""),
    (r"\s*\&\s*", " and "),
    (r"^\s+", ""),
    (r"\s+$", ""),
    (r"\'|\.", ""),
    (r"[^A-z0-9 ]", "_"),
    (r"^\s*ms\.?\s+", ""),
]

# Create a single regex with all substitutions
ARTIST_NORMALIZATION_REGEX = re.compile(
    "|".join("(%s)" % a[0] for a in ARTIST_SUBSTITUTIONS)
)

# https://stackoverflow.com/questions/517923/what-is-the-best-way-to-remove-accents-normalize-in-a-python-unicode-string
def remove_accents(input_str):
    nfkd_form = unicodedata.normalize("NFKD", input_str)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])


assert remove_accents("àbçdéfghîjkłmñö") == "abcdefghijkłmno"


def canonicalize(artist):
    return ARTIST_NORMALIZATION_REGEX.sub(
        lambda mo: ARTIST_SUBSTITUTIONS[mo.lastindex - 1][1],
        remove_accents(artist.lower()),
    )


assert canonicalize("Ms. Lauryn Hill") == "lauryn hill"


def load_json(filename):
    with open(filename, "r") as infile:
        return json.load(infile)


def save_json(filename, obj):
    with open(filename, "w") as outfile:
        json.dump(obj, outfile)


def safe_len(ar) -> int:
    return len(ar) if ar is not None else 0


class Model:
    FACTORS = 64

    def __init__(self):
        self.playlist_model = HNSWLibAlternatingLeastSquares(
            factors=self.FACTORS, dtype=np.float32, num_threads=2
        )
        self.artist_names = []
        self.artist_by_name = {}
        self.playlist_ids = []
        self.playlist_set = set()
        self.dirty_playlists = 0
        self.dirty_artists = 0
        self.child_pid = 0

    def add_artists(self, artist_factors, artists_names: list):
        new_artists = [canonicalize(a) for a in artists_names]
        self.playlist_model.add_items(artist_factors)
        self.set_artists(self.artist_names + new_artists)

    def set_artists(self, artist_names: list):
        self.artist_names = artist_names
        log.info("Loaded %s artists" % len(self.artist_names))
        assert len(self.playlist_model.item_factors) == len(self.artist_names)
        # assert self.playlist_model.item_factors.shape[1] == self.playlist_model.factors
        self.artist_by_name = dict(
            zip(self.artist_names, range(len(self.artist_names)))
        )
        self.dirty_artists += len(artist_names) or 1

    def set_playlist_urls(self, playlist_ids: list):
        self.playlist_ids = playlist_ids
        log.info("Loaded %s playlists" % len(self.playlist_ids))
        assert len(self.playlist_model.user_factors) == len(self.playlist_ids)
        # assert self.playlist_model.user_factors.shape[1] == self.playlist_model.factors
        self.playlist_set = set(self.playlist_ids)
        self.dirty_playlists += len(playlist_ids) or 1

    def load(self, folder=STORAGE_FOLDER):
        log.info("Loading model from " + folder)
        self.playlist_model.load_indexes(folder)
        self.set_artists(load_json(os.path.join(folder, ARTISTS_JSON)))
        self.set_playlist_urls(load_json(os.path.join(folder, PLAYLISTS_JSON)))
        self.dirty_playlists = 0
        self.dirty_artists = 0

    def process_playlist(self, tracks: list, id_: str, **kwargs) -> dict:
        log.debug("Processing playlist %s", id_)
        artists = [artist for track in tracks for artist in track["artists"]]
        return self.process_artists(artists, id_, **kwargs)

    def save(self, folder=STORAGE_FOLDER):
        log.info("Saving model to " + folder)
        assert safe_len(self.playlist_model.user_factors) == len(self.playlist_ids)
        assert safe_len(self.playlist_model.item_factors) == len(self.artist_names)
        self.playlist_model.save_indexes(
            folder,
            save_items=bool(self.dirty_artists),
            save_users=bool(self.dirty_playlists),
        )
        if self.dirty_playlists:
            self.dirty_playlists = 0
            save_json(os.path.join(folder, PLAYLISTS_JSON), self.playlist_ids)
        if self.dirty_artists:
            self.dirty_artists = 0
            save_json(os.path.join(folder, ARTISTS_JSON), self.artist_names)

    def save_async(self, **kwargs) -> bool:
        if self.dirty_artists == self.dirty_playlists == 0:
            return False  # nothing to do here
        if self.child_pid and os.waitpid(self.child_pid, os.WNOHANG) == (0, 0):
            return False  # previous child is still busy saving
        self.child_pid = os.fork()
        if self.child_pid == 0:
            try:
                self.save(**kwargs)
                os._exit(0)  # success
            except:
                os._exit(1)  # failure
        self.dirty_artists = 0
        self.dirty_playlists = 0
        return True

    def process_artists(
        self, artists: list, id_: str, update=True, recommend=True, N: int = 4
    ) -> dict:
        log.debug("Processing artists for playlist %s", id_)
        assert N > 0
        # TODO: count multiple occurrences of the same artist so we can improve confidence
        artist_ids = [self.artist_by_name.get(canonicalize(name)) for name in artists]
        # TODO: create new columns for unknown artists (instead of removing them)
        artist_ids = [a for a in artist_ids if a != None]
        if len(artist_ids) == 0:
            log.warning("No known artists", extra={"artists": artists})
            return {}
        # TODO: determine proper "bm25" weight for each artist
        user_plays = scipy.sparse.coo_matrix(
            ([444.0] * len(artist_ids), ([0] * len(artist_ids), artist_ids)),
            shape=(1, len(self.artist_names)),
        )
        playlist_factors = self.playlist_model.recalculate_user(0, user_plays)
        if id_:
            id_ = id_.lower()
        known_id = id_ in self.playlist_set

        try:
            playlists = self.playlist_model.similar_users_by_factors(
                playlist_factors, N=N + 1 if known_id else N
            )
        except Exception as e:
            log.error("Error during similar_users_by_factors: %s", e)
            playlists = []

        if update and id_ and not known_id:
            self.add_playlist(playlist_factors, id_)

        new_artists = None
        if recommend:
            artists = self.playlist_model.recommend(
                0, user_plays.tocsr(), recalculate_user=True, N=N
            )
            new_artists = [self.artist_names[pair[0]] for pair in artists]
        new_playlists = [self.playlist_ids[pair[0]] for pair in playlists]
        new_playlists = [i for i in new_playlists if i != id_]
        return {"artists": new_artists, "playlists": new_playlists}

    def add_playlist(self, playlist_factors, id_: str) -> int:
        assert id_ and id_ not in self.playlist_set
        playlist_id = len(self.playlist_ids)
        count = self.playlist_model.add_users(playlist_factors)
        self.playlist_ids.append(id_)
        self.playlist_set.add(id_)
        assert len(self.playlist_ids) == len(self.playlist_set) == count
        log.debug("Playlist %s stored as %s", id_, playlist_id)
        self.dirty_playlists += 1
        return playlist_id

    def reset(self):
        self.playlist_model.set_user_factors([])
        self.set_playlist_urls([])

    def fit(self, plays, playlist_ids: list, artists: list):
        Ciu = bm25_weight(plays, K1=100, B=0.8)
        self.playlist_model.fit(Ciu, show_progress=False)
        self.set_artists(artists)
        self.set_playlist_urls(playlist_ids)
