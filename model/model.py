# -*- coding: utf-8 -*-
import json
import logging
import re
import unicodedata
from os import getenv, path

import numpy as np
import scipy
from hnsw_als import HNSWLibAlternatingLeastSquares
from implicit.nearest_neighbours import bm25_weight

ARTISTS_JSON = "artists.json"
PLAYLISTS_JSON = "playlists.json"
PROJECT_ROOT = path.dirname(path.dirname(path.abspath(__file__)))
STORAGE_FOLDER = getenv("STORAGE_FOLDER", PROJECT_ROOT)

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
        self.dirty_playlists = False
        self.dirty_artists = False

    def add_artists(self, artist_factors, artists_names: list):
        new_artists = [canonicalize(a) for a in artists_names]
        self.playlist_model.add_items(artist_factors)
        self.set_artists(self.artist_names + new_artists)

    def set_artists(self, artist_names: list):
        self.artist_names = artist_names
        log.info("Loaded %s artists" % len(self.artist_names))
        # print("Loaded %s artists" % len(self.playlist_model.item_factors))
        assert len(self.playlist_model.item_factors) == len(self.artist_names)
        # assert self.playlist_model.item_factors.shape[1] == self.playlist_model.factors
        self.artist_by_name = dict(
            zip(self.artist_names, range(len(self.artist_names)))
        )
        self.dirty_artists = True

    def set_playlist_urls(self, playlist_ids: list):
        self.playlist_ids = playlist_ids
        log.info("Loaded %s playlists" % len(self.playlist_ids))
        # print("Loaded %s playlists" % len(self.playlist_model.user_factors))
        assert len(self.playlist_model.user_factors) == len(self.playlist_ids)
        # assert self.playlist_model.user_factors.shape[1] == self.playlist_model.factors
        self.playlist_set = set(self.playlist_ids)
        self.dirty_playlists = True

    def load(self, dir=STORAGE_FOLDER):
        log.info("Loading model from " + dir)
        self.playlist_model.load_indexes(dir)
        self.set_artists(load_json(path.join(dir, ARTISTS_JSON)))
        self.set_playlist_urls(load_json(path.join(dir, PLAYLISTS_JSON)))
        self.dirty_playlists = False
        self.dirty_artists = False

    def process_playlist(self, tracks: list, id_: str, **kwargs) -> dict:
        log.debug("Processing playlist %s", id_)
        artists = [artist for track in tracks for artist in track["artists"]]
        return self.process_artists(artists, id_, **kwargs)

    def save(self, dir=STORAGE_FOLDER):
        log.info("Saving model to " + dir)
        assert safe_len(self.playlist_model.user_factors) == len(self.playlist_ids)
        assert safe_len(self.playlist_model.item_factors) == len(self.artist_names)
        self.playlist_model.save_indexes(
            dir, save_items=self.dirty_artists, save_users=self.dirty_playlists
        )
        if self.dirty_playlists:
            self.dirty_playlists = False
            save_json(path.join(dir, PLAYLISTS_JSON), self.playlist_ids)
        if self.dirty_artists:
            self.dirty_artists = False
            save_json(path.join(dir, ARTISTS_JSON), self.artist_names)

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
            self.playlist_model.add_users(playlist_factors)
            playlist_id = len(self.playlist_ids)
            self.playlist_ids.append(id_)
            self.playlist_set.add(id_)
            assert len(self.playlist_ids) == len(self.playlist_set)
            log.debug("Playlist %s stored as %s", id_, playlist_id)
            self.dirty_playlists = True

        new_artists = None
        if recommend:
            artists = self.playlist_model.recommend(
                0, user_plays.tocsr(), recalculate_user=True, N=N
            )
            new_artists = [self.artist_names[pair[0]] for pair in artists]
        new_playlists = [self.playlist_ids[pair[0]] for pair in playlists]
        new_playlists = [i for i in new_playlists if i != id_]
        return {"artists": new_artists, "playlists": new_playlists}

    def reset(self):
        self.playlist_model.set_user_factors([])
        self.set_playlist_urls([])

    def fit(self, plays, playlist_ids: list, artists: list):
        Ciu = bm25_weight(plays, K1=100, B=0.8)
        self.playlist_model.fit(Ciu, show_progress=False)
        self.set_artists(artists)
        self.set_playlist_urls(playlist_ids)
