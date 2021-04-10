# -*- coding: utf-8 -*-
import json
import logging
import re
import unicodedata
from pathlib import Path

import numpy as np
import scipy
from hnsw_als import HNSWLibAlternatingLeastSquares

MODEL_DIR = Path(__file__).absolute().parent

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


class Model:
    def __init__(self):
        self.playlist_model = HNSWLibAlternatingLeastSquares(
            factors=64, dtype=np.float32, num_threads=2
        )
        self.artists = []
        self.playlist_urls = []
        self.artist_by_name = {}
        self.dirty_playlists = False

    def load(self):
        self.playlist_model.load_indexes(MODEL_DIR)

        self.artists = load_json(MODEL_DIR / "artists.json")
        log.info("Loaded %s artists" % len(self.artists))
        # print("Loaded %s artists" % len(self.playlist_model.item_factors))
        self.artist_by_name = dict(zip(self.artists, range(len(self.artists))))
        assert len(self.playlist_model.item_factors) == len(self.artists)
        # assert self.playlist_model.item_factors.shape[1] == self.playlist_model.factors

        self.playlist_urls = load_json(MODEL_DIR / "playlists.json")
        log.info("Loaded %s playlists" % len(self.playlist_urls))
        # print("Loaded %s playlists" % len(self.playlist_model.user_factors))
        assert len(self.playlist_model.user_factors) == len(self.playlist_urls)
        # assert self.playlist_model.user_factors.shape[1] == self.playlist_model.factors

    def process_playlist(self, url: str, tracks: list, **kwargs) -> dict:
        artist_names = [artist for track in tracks for artist in track["artists"]]
        return self.process_artists(url, artist_names, **kwargs)

    def save(self):
        self.dirty_playlists = False
        assert self.playlist_model.user_factors.shape[0] == len(self.playlist_urls)
        assert self.playlist_model.item_factors.shape[0] == len(self.artists)
        save_json(MODEL_DIR / "playlists.json", self.playlist_urls)
        self.playlist_model.save_indexes(MODEL_DIR, save_items=False)
        # save_json(MODEL_DIR / "artists.json", self.artists)

    def process_artists(
        self, url: str, artist_names: list, update=True, recommend=True
    ) -> dict:
        # TODO: count multiple occurrences of the same artist so we can improve confidence
        artist_ids = [
            self.artist_by_name.get(canonicalize(name)) for name in artist_names
        ]
        # TODO: create new columns for unknown artists (instead of removing them)
        artist_ids = [a for a in artist_ids if a != None]
        if len(artist_ids) == 0:
            log.warn("no known artists")
            return None
        # TODO: determine proper "bm25" weight for each artist
        user_plays = scipy.sparse.coo_matrix(
            ([444.0] * len(artist_ids), ([0] * len(artist_ids), artist_ids)),
            shape=(1, len(self.artists)),
        )
        playlist_factors = self.playlist_model.recalculate_user(0, user_plays)

        playlists = self.playlist_model.similar_users_by_factors(playlist_factors)
        newplaylists = [self.playlist_urls[pair[0]] for pair in playlists]

        if update:
            self.playlist_model.add_users(playlist_factors)

            playlist_id = len(self.playlist_urls)
            self.playlist_urls.append(url)
            log.info(playlist_id, url)
            self.dirty_playlists = True

        newartists = None
        if recommend:
            newartists = [
                self.artists[pair[0]]
                for pair in self.playlist_model.recommend(
                    0, user_plays.tocsr(), recalculate_user=True
                )
            ]
        return {"artists": newartists, "playlists": newplaylists}

    def reset(self):
        self.playlist_model.set_user_factors([])
        self.playlist_urls = []
        self.dirty_playlists = True
