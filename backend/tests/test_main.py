import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    """テスト用クライアント"""
    return TestClient(app)


class TestHealthCheck:
    """ヘルスチェックのテスト"""

    def test_health_check_returns_ok_with_local_mode(self, client):
        """ヘルスチェックが ok と local モードを返す"""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["mode"] == "local"

    def test_health_check_returns_s3_mode_in_production(self, client):
        """本番環境では s3 モードを返す"""
        with patch.dict(os.environ, {"ENV": "production"}):
            # config を再読み込み
            import importlib

            from api import config

            importlib.reload(config)
            # routes も再読み込み
            from api import routes

            importlib.reload(routes)

            response = client.get("/api/health")
            data = response.json()
            assert data["mode"] == "s3"

            # 元に戻す
            with patch.dict(os.environ, {"ENV": "development"}):
                importlib.reload(config)
                importlib.reload(routes)


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


class TestS3UploadUrl:
    """S3 アップロード URL 生成のテスト"""

    def test_upload_url_fails_without_bucket(self, client):
        """S3 バケットが設定されていない場合は 500 を返す"""
        response = client.post(
            "/api/upload-url",
            json={"filename": "test.wav", "content_type": "audio/wav"},
        )
        assert response.status_code == 500
        assert "S3 bucket not configured" in response.json()["detail"]

    def test_upload_url_success_with_bucket(self, client):
        """S3 バケットが設定されている場合は URL を返す"""
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/upload"

        with (
            patch("api.routes.S3_BUCKET", "test-bucket"),
            patch("api.routes.get_s3_client", return_value=mock_s3),
        ):
            response = client.post(
                "/api/upload-url",
                json={"filename": "test.wav", "content_type": "audio/wav"},
            )
            assert response.status_code == 200
            data = response.json()
            assert "upload_url" in data
            assert "s3_key" in data
            assert data["s3_key"].startswith("input/")
            assert data["s3_key"].endswith(".wav")


class TestS3DownloadUrl:
    """S3 ダウンロード URL 生成のテスト"""

    def test_download_url_fails_without_bucket(self, client):
        """S3 バケットが設定されていない場合は 500 を返す"""
        response = client.get("/api/download-url/output/test.wav")
        assert response.status_code == 500
        assert "S3 bucket not configured" in response.json()["detail"]

    def test_download_url_success_with_bucket(self, client):
        """S3 バケットが設定されている場合は URL を返す"""
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/download"

        with (
            patch("api.routes.S3_BUCKET", "test-bucket"),
            patch("api.routes.get_s3_client", return_value=mock_s3),
        ):
            response = client.get("/api/download-url/output/test.wav")
            assert response.status_code == 200
            data = response.json()
            assert data["download_url"] == "https://s3.example.com/download"


class TestS3Process:
    """S3 音声処理のテスト"""

    def test_s3_process_fails_without_bucket(self, client):
        """S3 バケットが設定されていない場合は 500 を返す"""
        response = client.post(
            "/api/s3-process",
            json={"s3_key": "input/test.wav", "effect_chain": []},
        )
        assert response.status_code == 500
        assert "S3 bucket not configured" in response.json()["detail"]

    def test_s3_process_returns_normalized_urls(self, client, tmp_path):
        """S3 処理が正規化 URL を返す"""
        import numpy as np
        from pedalboard.io import AudioFile

        # テスト用の音声ファイルを作成
        test_audio = tmp_path / "test_input.wav"
        sample_rate = 44100
        audio_data = np.sin(2 * np.pi * 440 * np.arange(sample_rate) / sample_rate)
        audio_data = audio_data.reshape(1, -1).astype(np.float32)
        with AudioFile(str(test_audio), "w", sample_rate, 1) as f:
            f.write(audio_data)

        mock_s3 = MagicMock()
        mock_s3.download_file.side_effect = lambda bucket, key, path: __import__(
            "shutil"
        ).copy(str(test_audio), path)
        mock_s3.upload_file.return_value = None
        mock_s3.generate_presigned_url.side_effect = lambda op, Params, ExpiresIn: (
            f"https://s3.example.com/{Params['Key']}"
        )

        with (
            patch("api.routes.S3_BUCKET", "test-bucket"),
            patch("api.routes.get_s3_client", return_value=mock_s3),
        ):
            response = client.post(
                "/api/s3-process",
                json={
                    "s3_key": "input/test.wav",
                    "effect_chain": [{"name": "reverb", "params": {}}],
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert "output_key" in data
            assert "download_url" in data
            assert "effects_applied" in data
            assert "input_normalized_url" in data
            assert "output_normalized_url" in data
            assert "reverb" in data["effects_applied"]
            assert "normalized" in data["input_normalized_url"]
            assert "normalized" in data["output_normalized_url"]
