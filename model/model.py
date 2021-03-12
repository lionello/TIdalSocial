import re
import unicodedata
from pathlib import Path

import nmslib
import numpy as np
import scipy
from implicit.approximate_als import (
    NMSLibAlternatingLeastSquares,
    augment_inner_product_matrix,
)
from werkzeug.exceptions import BadRequest

MODEL_DIR = Path(__file__).absolute().parent


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


class Model:
    def __init__(self):
        self.playlist_model = NMSLibAlternatingLeastSquares(
            factors=64, dtype=np.float32
        )

    def load(self):
        with np.load(MODEL_DIR / "artist_factors.npz") as data:
            assert data["arr_0"].shape[0] == len(data["arr_1"])
            self.playlist_model.item_factors = data["arr_0"]
            self.artists = data["arr_1"].tolist()
        print("Loaded %s artists" % self.playlist_model.item_factors.shape[0])
        self.artist_by_name = dict(zip(self.artists, range(len(self.artists))))
        assert self.playlist_model.item_factors.shape[0], len(self.artists)
        assert self.playlist_model.item_factors.shape[1] == self.playlist_model.factors

        with np.load(MODEL_DIR / "playlist_factors.npz") as data:
            if data["arr_0"].shape[0] == len(data["arr_1"]):
                self.playlist_model.user_factors = data["arr_0"]
                self.playlist_urls = data["arr_1"].tolist()
        print("Loaded %s playlists" % self.playlist_model.user_factors.shape[0])
        assert self.playlist_model.user_factors.shape[0] == len(self.playlist_urls)
        assert self.playlist_model.user_factors.shape[1] == self.playlist_model.factors
        update_playlist_index(self.playlist_model)

    def process_playlist(self, url, tracks, **kwargs):
        artist_names = [artist for track in tracks for artist in track["artists"]]
        return self.process_artists(url, artist_names, **kwargs)

    def process_artists(self, url, artist_names, update=True, recommend=True):
        # TODO: count multiple occurrences of the same artist so we can improve confidence
        artist_ids = [
            self.artist_by_name.get(canonicalize(name)) for name in artist_names
        ]
        # TODO: create new columns for unknown artists (instead of removing them)
        artist_ids = [a for a in artist_ids if a != None]
        if len(artist_ids) == 0:
            raise BadRequest("no known artists")
        # TODO: determine proper "bm25" weight for each artist
        user_plays = scipy.sparse.coo_matrix(
            ([444.0] * len(artist_ids), ([0] * len(artist_ids), artist_ids)),
            shape=(1, len(self.artists)),
        )
        playlist_factors = self.playlist_model.recalculate_user(0, user_plays)

        # TODO: make this more efficient and/or allow playlist updates
        if url in self.playlist_urls:
            update = False

        newplaylists = []
        if not (self.playlist_model.user_factors is None):
            playlists = similar_playlists(self.playlist_model, playlist_factors)
            newplaylists = [self.playlist_urls[id] for id in playlists[0]]

            if update:
                # Add this playlist's factors to the model
                self.playlist_model.user_factors = np.vstack(
                    (self.playlist_model.user_factors, playlist_factors)
                )
        elif update:
            self.playlist_model.user_factors = np.reshape(
                playlist_factors, (1, self.playlist_model.factors)
            )

        if update:
            playlist_id = len(self.playlist_urls)
            self.playlist_urls.append(url)
            print(playlist_id, url)

            assert self.playlist_model.user_factors.shape[0] == len(self.playlist_urls)
            # save_json(MODEL_DIR / "playlists.json", playlist_urls)

            np.savez_compressed(
                MODEL_DIR / "playlist_factors.npz",
                self.playlist_model.user_factors,
                self.playlist_urls,
            )
            update_playlist_index(self.playlist_model)

        newartists = []
        if recommend:
            if self.playlist_model.recommend_index is None:
                update_recommend_index(self.playlist_model)  # SLOW

            newartists = [
                self.artists[pair[0]]
                for pair in self.playlist_model.recommend(
                    0, user_plays.tocsr(), recalculate_user=True
                )
            ]
        return {"artists": newartists, "playlists": newplaylists}

    def reset(self):
        self.playlist_model.user_factors = None
        self.playlist_urls = []


def update_recommend_index(model):
    print("Building recommendation index...")

    model.max_norm, extra = augment_inner_product_matrix(model.item_factors)
    model.recommend_index = nmslib.init(method="hnsw", space="cosinesimil")
    # TODO: implement incremental index updates
    model.recommend_index.addDataPointBatch(extra)
    model.recommend_index.createIndex(model.index_params)  # SLOW
    model.recommend_index.setQueryTimeParams(model.query_params)


def similar_playlists(model, user_factors, N=10):
    return model.similar_users_index.knnQuery(user_factors, N)


def update_playlist_index(model):
    norms = np.linalg.norm(model.user_factors, axis=1)
    ids = np.arange(model.user_factors.shape[0])

    # delete zero valued rows from the matrix
    user_factors = np.delete(model.user_factors, ids[norms == 0], axis=0)
    ids = ids[norms != 0]

    model.similar_users_index = nmslib.init(method=model.method, space="cosinesimil")
    # TODO: implement incremental index updates
    model.similar_users_index.addDataPointBatch(user_factors, ids=ids)
    model.similar_users_index.createIndex(model.index_params)
    model.similar_users_index.setQueryTimeParams(model.query_params)
