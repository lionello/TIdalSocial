import itertools
import logging
import os
import tempfile

import hnswlib
import numpy
from implicit.als import AlternatingLeastSquares
from implicit.approximate_als import augment_inner_product_matrix

log = logging.getLogger("hnsw_als")


def _safe_len(index) -> int:
    if index is None:
        return 0
    return index.get_current_count()


class HNSWLibAlternatingLeastSquares(AlternatingLeastSquares):
    method = "hnsw"

    def __init__(
        self,
        factors: int,
        approximate_similar_items: bool = True,
        approximate_similar_users: bool = True,
        approximate_recommend: bool = True,
        index_params: dict = None,
        query_params: dict = None,
        random_state=None,
        space="cosine",  # possible options are l2, cosine or ip
        *args,
        **kwargs
    ):
        if index_params is None:
            index_params = {"M": 16, "post": 0, "efConstruction": 400}
        if query_params is None:
            query_params = {"ef": 90}

        self.similar_items_index = None
        self.recommend_index = None
        self.similar_users_index = None

        self.approximate_similar_items = approximate_similar_items
        self.approximate_recommend = approximate_recommend
        self.approximate_similar_users = approximate_similar_users
        self.space = space

        self.index_params = index_params
        self.query_params = query_params
        self.max_norm = 0.0

        super(HNSWLibAlternatingLeastSquares, self).__init__(
            *args, random_state=random_state, factors=factors, **kwargs
        )

    @staticmethod
    def _save_index(index, folder: str, filename: str):
        path = os.path.join(folder, filename + str(index.dim))
        log.debug("Saving hnswlib index " + path)
        # Avoid corrupting an existing index by saving to a temporary file first
        with tempfile.NamedTemporaryFile(dir=folder, delete=False) as tmp:
            index.save_index(tmp.name)
        os.replace(tmp.name, path)

    def _load_index(self, dim: int, folder: str, filename: str, max_elements: int):
        path = os.path.join(folder, filename + str(dim))
        log.debug("Loading hnswlib index " + path)
        index = self._create_index(dim)
        try:
            index.load_index(path, max_elements=max_elements)
        except RuntimeError as e:
            if str(e) != "Cannot open file":
                raise e
            log.warning(e, extra={"folder": folder, "filename_": filename})
            index.init_index(
                max_elements=max_elements,
                ef_construction=self.index_params["efConstruction"],
                M=self.index_params["M"],
            )
        return index

    def load_indexes(self, folder: str, max_items: int = 0, max_users: int = 0):
        if self.approximate_similar_items:
            self.similar_items_index = self._load_index(
                self.factors,
                folder,
                "similar_items_index.bin",
                max_elements=max_items,
            )
            count = self.similar_items_index.get_current_count()
            self.item_factors = numpy.reshape(
                self.similar_items_index.get_items(range(count)),
                (count, self.factors),
            ).astype(self.dtype)
        if self.approximate_recommend:
            self.recommend_index = self._load_index(
                self.factors + 1,
                folder,
                "recommend_index.bin",
                max_elements=max_items,
            )
        if self.approximate_similar_users:
            self.similar_users_index = self._load_index(
                self.factors,
                folder,
                "similar_users_index.bin",
                max_elements=max_users,
            )
            count = self.similar_users_index.get_current_count()
            self.user_factors = numpy.reshape(
                self.similar_users_index.get_items(range(count)),
                (count, self.factors),
            ).astype(self.dtype)

    def save_indexes(self, folder: str, save_items=True, save_users=True):
        if self.similar_items_index and save_items:
            self._save_index(
                self.similar_items_index, folder, "similar_items_index.bin"
            )
        if self.recommend_index and save_items:
            self._save_index(self.recommend_index, folder, "recommend_index.bin")
        if self.similar_users_index and save_users:
            self._save_index(
                self.similar_users_index, folder, "similar_users_index.bin"
            )

    def _make_matrix(self, factors):
        if numpy.ndim(factors) == 1 and len(factors) == self.factors:
            return numpy.reshape(factors, (1, self.factors)).astype(self.dtype)
        return numpy.reshape(factors, (len(factors), self.factors)).astype(self.dtype)

    def set_user_factors(self, user_factors):
        self.user_factors = self._make_matrix(user_factors)
        if self.approximate_similar_users:
            self._build_similar_users_index()

    def set_item_factors(self, item_factors):
        self.item_factors = self._make_matrix(item_factors)

        # create index for similar_items
        if self.approximate_similar_items:
            self._build_similar_items_index()

        # build up a separate index for the inner product (for recommend
        # methods)
        if self.approximate_recommend:
            self._build_recommend_index()

    def _create_index(self, dim: int) -> hnswlib.Index:
        index = hnswlib.Index(space=self.space, dim=dim)
        index.set_ef(self.query_params["ef"])
        if self.num_threads:
            index.set_num_threads(self.num_threads)
        return index

    def _init_index(self, dim: int, factors=None) -> hnswlib.Index:
        index = self._create_index(dim)
        index.init_index(
            max_elements=len(factors),
            ef_construction=self.index_params["efConstruction"],
            M=self.index_params["M"],
        )
        if factors is not None and len(factors) > 0:
            index.add_items(factors)
        return index

    def _build_similar_users_index(self):
        log.debug("Building hnswlib similar users index")
        self.similar_users_index = self._init_index(self.factors, self.user_factors)

    def _build_similar_items_index(self):
        log.debug("Building hnswlib similar items index")
        # there are some numerical instability issues here with
        # building a cosine index with vectors with 0 norms, hack around this
        # by just not indexing them
        norms = numpy.linalg.norm(self.item_factors, axis=1)
        if 0 in norms:
            log.warning("numerical instability issues with cosine index")
        # ids = numpy.arange(self.item_factors.shape[0])
        # delete zero valued rows from the matrix TODO
        # item_factors = numpy.delete(self.item_factors, ids[norms == 0], axis=0)
        # ids = ids[norms != 0]

        self.similar_items_index = self._init_index(self.factors, self.item_factors)

    def _build_recommend_index(self):
        log.debug("Building hnswlib recommendation index")
        self.max_norm, extra = augment_inner_product_matrix(self.item_factors)
        self.recommend_index = self._init_index(self.factors + 1, extra)

    def similar_users(self, user_id: int, N: int = 10):
        if not self.approximate_similar_users:
            return super(HNSWLibAlternatingLeastSquares, self).similar_users(user_id, N)
        return self.similar_users_by_factors(self.user_factors[user_id], N)

    def similar_users_by_factors(self, user_factors1, N: int = 10):
        assert self.approximate_similar_users
        N = min(N, _safe_len(self.similar_users_index))
        if N == 0:
            return []
        neighbours, distances = self.similar_users_index.knn_query(user_factors1, k=N)
        return zip(neighbours[0], 1.0 - distances[0])

    def fit(self, Ciu, show_progress=True):
        super(HNSWLibAlternatingLeastSquares, self).fit(Ciu, show_progress)
        self.set_item_factors(self.item_factors)
        self.set_user_factors(self.user_factors)

    def similar_items(self, itemid: int, N: int = 10):
        if not self.approximate_similar_items:
            return super(HNSWLibAlternatingLeastSquares, self).similar_items(itemid, N)
        return self.similar_items_by_factors(self.item_factors[itemid], N)

    def similar_items_by_factors(self, item_factors1, N: int = 10):
        assert self.approximate_similar_items
        N = min(N, _safe_len(self.similar_items_index))
        if N == 0:
            return []
        neighbours, distances = self.similar_items_index.knn_query(item_factors1, k=N)
        return zip(neighbours[0], 1.0 - distances[0])

    @staticmethod
    def _add_factors_to_index(index, factors, grow: int):
        count = index.get_current_count() + len(factors)
        if index.get_max_elements() <= count:
            index.resize_index(count + grow)
        index.add_items(factors)

    def _add_factors_to_matrix(self, matrix, factors):
        if matrix is None:
            return self._make_matrix(factors)
        else:
            return numpy.vstack((matrix, factors))

    def add_users(self, user_factors, grow: int = 16) -> int:
        self.user_factors = self._add_factors_to_matrix(self.user_factors, user_factors)
        if self.approximate_similar_users:
            if self.similar_users_index is None:
                self._build_similar_users_index()
            else:
                self._add_factors_to_index(self.similar_users_index, user_factors, grow)
        return len(self.user_factors)

    def add_items(self, item_factors, grow: int = 16) -> int:
        self.item_factors = self._add_factors_to_matrix(self.item_factors, item_factors)
        if self.approximate_similar_items:
            if self.similar_items_index is None:
                self._build_similar_items_index()
            else:
                self._add_factors_to_index(self.similar_items_index, item_factors, grow)
        if self.approximate_recommend:
            if self.recommend_index is None:
                self._build_recommend_index()
            else:
                # augment_inner_product_matrix only accepts a matrix; make one
                matrix = self._make_matrix(item_factors)
                max_norm, extra = augment_inner_product_matrix(matrix)
                if max_norm > self.max_norm:
                    self.max_norm = max_norm
                self._add_factors_to_index(self.recommend_index, extra, grow)
        return len(self.item_factors)

    def recommend(
        self,
        userid: int,
        user_items,
        N: int = 10,
        filter_already_liked_items: bool = True,
        filter_items=None,
        recalculate_user: bool = False,
    ):
        if recalculate_user and self.item_factors is None:
            raise Exception("recalculate_user=True requires item_factors to be set")
        if not recalculate_user and self.user_factors is None:
            raise Exception("recalculate_user=False requires user_factors to be set")

        if not self.approximate_recommend:
            return super(HNSWLibAlternatingLeastSquares, self).recommend(
                userid,
                user_items,
                N=N,
                filter_items=filter_items,
                recalculate_user=recalculate_user,
            )

        user = self._user_factor(userid, user_items, recalculate_user)

        # calculate the top N items, removing the users own liked items from
        # the results
        liked = set()
        if filter_already_liked_items:
            liked.update(user_items[userid].indices)
        if filter_items:
            liked.update(filter_items)
        count = min(N + len(liked), self.recommend_index.get_current_count())

        query = numpy.append(user, 0)
        ids, dist = self.recommend_index.knn_query(query, k=count)

        # convert the distances from euclidean to cosine distance,
        # and then rescale the cosine distance to go back to inner product
        scaling = self.max_norm * numpy.linalg.norm(query)
        dist = scaling * (1.0 - dist)
        return list(
            itertools.islice(
                (rec for rec in zip(ids[0], dist[0]) if rec[0] not in liked), N
            )
        )
