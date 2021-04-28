import shutil
import tempfile
import unittest

import numpy
import scipy

from model import Model

ARTISTS = 300
PLAYLISTS = 11


class TestModel(unittest.TestCase):
    TEST_MODEL = "/tmp/TestModel"

    @classmethod
    def setUpClass(cls):
        cls.TEST_MODEL = tempfile.mkdtemp()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.TEST_MODEL)

    def setUp(self):
        self.model = Model()

    def test_add_artists(self):
        artist_factors = numpy.random.rand(4, Model.FACTORS) * 0.2 - 0.1
        self.model.add_artists(
            artist_factors, ["dEUS", "Spinal Tap", "Josie and the Pussycats", "Anvil"]
        )
        self.assertIsNotNone(self.model.playlist_model)
        self.assertIsNone(self.model.playlist_model.user_factors)
        self.assertIsNotNone(self.model.playlist_model.item_factors)
        self.assertTrue(self.model.artist_names)
        self.assertFalse(self.model.dirty_playlists)
        self.assertTrue(self.model.dirty_artists)

    def test_init(self):
        self.assertIsNotNone(self.model.playlist_model)
        self.assertIsNone(self.model.playlist_model.user_factors)
        self.assertIsNone(self.model.playlist_model.item_factors)
        self.assertFalse(self.model.artist_names)
        self.assertFalse(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_fit(self):
        PLAYS = 50
        plays = scipy.sparse.csr_matrix(
            (
                numpy.random.randint(1, 10, size=PLAYLISTS * PLAYS),
                (
                    numpy.random.randint(0, ARTISTS, size=PLAYLISTS * PLAYS),
                    list(range(PLAYLISTS)) * PLAYS,
                ),
            ),
            shape=(ARTISTS, PLAYLISTS),
        )
        artists = [str(a) for a in range(ARTISTS)]
        playlists = [str(a) for a in range(PLAYLISTS)]
        self.model.fit(plays, playlists, artists)
        self.assertTrue(self.model.dirty_playlists)
        self.assertTrue(self.model.dirty_artists)
        self.assertEqual(ARTISTS, len(self.model.artist_names))
        self.assertEqual(ARTISTS, len(self.model.artist_by_name))
        self.assertEqual(PLAYLISTS, len(self.model.playlist_urls))

    def test_load(self):
        self.model.load(dir=self.TEST_MODEL)
        self.assertFalse(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_load_big(self):
        self.model.load()
        self.assertIsNotNone(self.model.playlist_model)
        self.assertIsNotNone(self.model.playlist_model.user_factors)
        self.assertIsNotNone(self.model.playlist_model.item_factors)
        # self.assertTrue(self.model.playlist_urls)
        self.assertTrue(self.model.artist_names)
        self.assertFalse(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_fit_then_save(self):
        self.test_fit()
        self.model.save(dir=self.TEST_MODEL)
        self.assertFalse(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_save_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.model.save(dir=tmp)
            self.assertFalse(self.model.dirty_playlists)
            self.assertFalse(self.model.dirty_artists)

    def test_process_playlist(self):
        self.model.load(dir=self.TEST_MODEL)
        res = self.model.process_playlist(
            "http://test_process_playlist", [{"artists": ["1"]}]
        )
        self.assertTrue(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertTrue(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_process_playlist_with_unknown(self):
        self.model.load(dir=self.TEST_MODEL)
        res = self.model.process_playlist(
            "http://test_process_playlist_with_unknown",
            [{"artists": ["1", "nonexistentartist"]}],
        )
        self.assertTrue(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertTrue(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_process_artists(self):
        self.model.load(dir=self.TEST_MODEL)
        res = self.model.process_artists("http://test_process_artists", ["2"])
        self.assertTrue(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertTrue(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_process_artists_twice(self):
        self.model.load(dir=self.TEST_MODEL)
        res = self.model.process_artists("2", ["2"])
        self.assertTrue(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertFalse(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_process_artists_no_update(self):
        self.model.load(dir=self.TEST_MODEL)
        res = self.model.process_artists(
            "http://test_process_artists_no_update", ["1"], update=False
        )
        self.assertTrue(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertFalse(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_process_artists_no_recommend(self):
        self.model.load(dir=self.TEST_MODEL)
        res = self.model.process_artists(
            "http://test_process_artists_no_recommend", ["1"], recommend=False
        )
        self.assertFalse(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertTrue(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_process_artists_no_update_recommend(self):
        self.model.load(dir=self.TEST_MODEL)
        res = self.model.process_artists(
            "http://test_process_artists_no_update_recommend",
            ["1"],
            update=False,
            recommend=False,
        )
        self.assertFalse(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertFalse(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_process_artists_unknown(self):
        res = self.model.process_artists(
            "http://test_process_artists_unknown", ["nonexistentartist"]
        )
        self.assertIsNone(res)
        self.assertFalse(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_reset(self):
        self.model.reset()
        self.assertListEqual(self.model.playlist_urls, [])
        self.assertTrue(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)

    def test_load_then_process(self):
        self.model.load(dir=self.TEST_MODEL)
        res = self.model.process_artists("http://test_load_then_process", ["1"])
        self.assertTrue(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertTrue(self.model.dirty_playlists)
        self.assertFalse(self.model.dirty_artists)
