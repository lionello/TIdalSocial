import unittest

from model import Model


class TestModel(unittest.TestCase):
    def setUp(self):
        self.model = Model()
        self.model.load()

    def test_load(self):
        self.assertIsNotNone(self.model.playlist_model)
        self.assertIsNotNone(self.model.playlist_model.user_factors)
        self.assertIsNotNone(self.model.playlist_model.item_factors)
        self.assertTrue(self.model.playlist_urls)
        self.assertTrue(self.model.artists)

    def test_process_playlist(self):
        res = self.model.process_playlist("http://blah", [{"artists": ["deus"]}])
        self.assertTrue(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertTrue(self.model.dirty_playlists)

    def test_process_playlist_with_unknown(self):
        res = self.model.process_playlist(
            "http://blah", [{"artists": ["deus", "nonexistentartist"]}]
        )
        self.assertTrue(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertTrue(self.model.dirty_playlists)

    def test_process_artists(self):
        res = self.model.process_artists("http://blah", ["deus"])
        self.assertTrue(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertTrue(self.model.dirty_playlists)

    def test_process_artists_no_update(self):
        res = self.model.process_artists("http://blah", ["deus"], update=False)
        self.assertTrue(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertFalse(self.model.dirty_playlists)

    def test_process_artists_no_recommend(self):
        res = self.model.process_artists("http://blah", ["deus"], recommend=False)
        self.assertFalse(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertTrue(self.model.dirty_playlists)

    def test_process_artists_no_update_recommend(self):
        res = self.model.process_artists(
            "http://blah", ["deus"], update=False, recommend=False
        )
        self.assertFalse(res["artists"])
        self.assertTrue(res["playlists"])
        self.assertFalse(self.model.dirty_playlists)

    def test_process_artists_unknown(self):
        res = self.model.process_artists("http://blah", ["nonexistentartist"])
        self.assertIsNone(res)
        self.assertFalse(self.model.dirty_playlists)

    def test_reset(self):
        self.model.reset()
        self.assertListEqual(self.model.playlist_urls, [])

    def test_reset_then_process(self):
        self.model.reset()
        res = self.model.process_artists("http://blah", ["deus"])
        self.assertTrue(res["artists"])
        self.assertFalse(res["playlists"])
        self.assertTrue(self.model.dirty_playlists)
