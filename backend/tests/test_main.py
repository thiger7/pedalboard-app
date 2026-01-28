import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    """テスト用クライアント"""
    return TestClient(app)


class TestHealthCheck:
    """ヘルスチェックのテスト"""

    def test_health_check_returns_ok(self, client):
        """ヘルスチェックが ok を返す"""
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestEffects:
    """エフェクト一覧のテスト"""

    def test_get_effects_returns_list(self, client):
        """エフェクト一覧を返す"""
        response = client.get("/api/effects")
        assert response.status_code == 200
        data = response.json()
        assert "effects" in data
        assert isinstance(data["effects"], list)
        assert len(data["effects"]) > 0

    def test_each_effect_has_required_fields(self, client):
        """各エフェクトに必須フィールドがある"""
        response = client.get("/api/effects")
        data = response.json()
        for effect in data["effects"]:
            assert "name" in effect
            assert "default_params" in effect
            assert "class_name" in effect


class TestInputFiles:
    """入力ファイル一覧のテスト"""

    def test_list_input_files_returns_list(self, client):
        """ファイル一覧を返す"""
        response = client.get("/api/input-files")
        assert response.status_code == 200
        data = response.json()
        assert "files" in data
        assert isinstance(data["files"], list)


class TestAudioEndpoints:
    """音声ファイルエンドポイントのテスト"""

    def test_get_nonexistent_audio_returns_404(self, client):
        """存在しないファイルは 404 を返す"""
        response = client.get("/api/audio/nonexistent.wav")
        assert response.status_code == 404

    def test_get_nonexistent_input_audio_returns_404(self, client):
        """存在しない入力ファイルは 404 を返す"""
        response = client.get("/api/input-audio/nonexistent.wav")
        assert response.status_code == 404

    def test_get_nonexistent_normalized_returns_404(self, client):
        """存在しない正規化ファイルは 404 を返す"""
        response = client.get("/api/normalized/nonexistent.wav")
        assert response.status_code == 404
