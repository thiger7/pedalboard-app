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


class TestLocalProcess:
    """ローカル音声処理のテスト"""

    def _create_test_audio(self, path):
        """テスト用の音声ファイルを作成"""
        import numpy as np
        from pedalboard.io import AudioFile

        sample_rate = 44100
        audio_data = np.sin(2 * np.pi * 440 * np.arange(sample_rate) / sample_rate)
        audio_data = audio_data.reshape(1, -1).astype(np.float32)
        with AudioFile(str(path), "w", sample_rate, 1) as f:
            f.write(audio_data)

    def test_process_output_filename_uses_original_name(self, client, tmp_path):
        """ローカル処理で出力ファイル名に元のファイル名が使われる"""
        # テスト用ディレクトリを作成
        input_dir = tmp_path / "input"
        output_dir = tmp_path / "output"
        normalized_dir = tmp_path / "normalized"
        input_dir.mkdir()
        output_dir.mkdir()
        normalized_dir.mkdir()

        # テスト用の音声ファイルを作成
        test_audio = input_dir / "my_song.wav"
        self._create_test_audio(test_audio)

        with (
            patch("api.routes.AUDIO_INPUT_DIR", input_dir),
            patch("api.routes.AUDIO_OUTPUT_DIR", output_dir),
            patch("api.routes.AUDIO_NORMALIZED_DIR", normalized_dir),
        ):
            response = client.post(
                "/api/process",
                json={
                    "input_file": "my_song.wav",
                    "effect_chain": [{"name": "reverb", "params": {}}],
                },
            )

            assert response.status_code == 200
            data = response.json()
            # 出力ファイル名が「元のファイル名_ランダム文字列.wav」形式
            assert data["output_file"].startswith("my_song_")
            assert data["output_file"].endswith(".wav")
            # ランダム部分が8文字
            name_without_ext = data["output_file"][:-4]  # .wav を除去
            random_part = name_without_ext.split("_")[-1]
            assert len(random_part) == 8

    def test_process_output_file_is_downloadable(self, client, tmp_path):
        """ローカル処理後に出力ファイルがダウンロードできる"""
        # テスト用ディレクトリを作成
        input_dir = tmp_path / "input"
        output_dir = tmp_path / "output"
        normalized_dir = tmp_path / "normalized"
        input_dir.mkdir()
        output_dir.mkdir()
        normalized_dir.mkdir()

        # テスト用の音声ファイルを作成
        test_audio = input_dir / "my_song.wav"
        self._create_test_audio(test_audio)

        with (
            patch("api.routes.AUDIO_INPUT_DIR", input_dir),
            patch("api.routes.AUDIO_OUTPUT_DIR", output_dir),
            patch("api.routes.AUDIO_NORMALIZED_DIR", normalized_dir),
        ):
            # 処理を実行
            process_response = client.post(
                "/api/process",
                json={
                    "input_file": "my_song.wav",
                    "effect_chain": [{"name": "reverb", "params": {}}],
                },
            )
            assert process_response.status_code == 200
            data = process_response.json()

            # ダウンロード URL からファイルを取得
            download_response = client.get(f"/api/audio/{data['output_file']}")
            assert download_response.status_code == 200
            assert download_response.headers["content-type"] == "audio/wav"
            # ファイルサイズが0より大きい
            assert len(download_response.content) > 0


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


class TestS3ProcessSync:
    """S3 音声同期処理のテスト"""

    def test_s3_process_sync_fails_without_bucket(self, client):
        """S3 バケットが設定されていない場合は 500 を返す"""
        response = client.post(
            "/api/s3-process-sync",
            json={"s3_key": "input/test.wav", "effect_chain": []},
        )
        assert response.status_code == 500
        assert "S3 bucket not configured" in response.json()["detail"]

    def test_s3_process_sync_returns_normalized_urls(self, client, tmp_path):
        """S3 同期処理が正規化 URL を返す"""
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
        mock_s3.download_file.side_effect = lambda bucket, key, path: __import__("shutil").copy(
            str(test_audio), path
        )
        mock_s3.upload_file.return_value = None
        mock_s3.generate_presigned_url.side_effect = lambda op, Params, ExpiresIn: (
            f"https://s3.example.com/{Params['Key']}"
        )

        with (
            patch("api.routes.S3_BUCKET", "test-bucket"),
            patch("api.routes.get_s3_client", return_value=mock_s3),
        ):
            response = client.post(
                "/api/s3-process-sync",
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

    def test_s3_process_sync_uses_original_filename_in_download(self, client, tmp_path):
        """S3 同期処理でダウンロードファイル名に元のファイル名が使われる"""
        import numpy as np
        from pedalboard.io import AudioFile

        # テスト用の音声ファイルを作成
        test_audio = tmp_path / "test_input.wav"
        sample_rate = 44100
        audio_data = np.sin(2 * np.pi * 440 * np.arange(sample_rate) / sample_rate)
        audio_data = audio_data.reshape(1, -1).astype(np.float32)
        with AudioFile(str(test_audio), "w", sample_rate, 1) as f:
            f.write(audio_data)

        captured_params = {}

        def capture_presigned_url(op, Params, ExpiresIn):
            if "ResponseContentDisposition" in Params:
                captured_params["disposition"] = Params["ResponseContentDisposition"]
            return f"https://s3.example.com/{Params['Key']}"

        mock_s3 = MagicMock()
        mock_s3.download_file.side_effect = lambda bucket, key, path: __import__("shutil").copy(
            str(test_audio), path
        )
        mock_s3.upload_file.return_value = None
        mock_s3.generate_presigned_url.side_effect = capture_presigned_url

        with (
            patch("api.routes.S3_BUCKET", "test-bucket"),
            patch("api.routes.get_s3_client", return_value=mock_s3),
        ):
            response = client.post(
                "/api/s3-process-sync",
                json={
                    "s3_key": "input/test.wav",
                    "effect_chain": [{"name": "reverb", "params": {}}],
                    "original_filename": "my_guitar.wav",
                },
            )

            assert response.status_code == 200
            # ダウンロードファイル名に元のファイル名が含まれる（RFC 5987 形式）
            assert "disposition" in captured_params
            assert "filename*=UTF-8''" in captured_params["disposition"]
            assert "my_guitar_" in captured_params["disposition"]
            assert ".wav" in captured_params["disposition"]

    def test_s3_process_sync_encodes_japanese_filename(self, client, tmp_path):
        """S3 同期処理で日本語ファイル名が正しくエンコードされる"""
        import numpy as np
        from pedalboard.io import AudioFile

        # テスト用の音声ファイルを作成
        test_audio = tmp_path / "test_input.wav"
        sample_rate = 44100
        audio_data = np.sin(2 * np.pi * 440 * np.arange(sample_rate) / sample_rate)
        audio_data = audio_data.reshape(1, -1).astype(np.float32)
        with AudioFile(str(test_audio), "w", sample_rate, 1) as f:
            f.write(audio_data)

        captured_params = {}

        def capture_presigned_url(op, Params, ExpiresIn):
            if "ResponseContentDisposition" in Params:
                captured_params["disposition"] = Params["ResponseContentDisposition"]
            return f"https://s3.example.com/{Params['Key']}"

        mock_s3 = MagicMock()
        mock_s3.download_file.side_effect = lambda bucket, key, path: __import__("shutil").copy(
            str(test_audio), path
        )
        mock_s3.upload_file.return_value = None
        mock_s3.generate_presigned_url.side_effect = capture_presigned_url

        with (
            patch("api.routes.S3_BUCKET", "test-bucket"),
            patch("api.routes.get_s3_client", return_value=mock_s3),
        ):
            response = client.post(
                "/api/s3-process-sync",
                json={
                    "s3_key": "input/test.wav",
                    "effect_chain": [{"name": "reverb", "params": {}}],
                    "original_filename": "単音.wav",
                },
            )

            assert response.status_code == 200
            # 日本語ファイル名が URL エンコードされている
            assert "disposition" in captured_params
            assert "filename*=UTF-8''" in captured_params["disposition"]
            # 「単音」は URL エンコードされるので直接含まれない
            assert "%E5%8D%98%E9%9F%B3" in captured_params["disposition"]  # 「単音」のURLエンコード
            assert ".wav" in captured_params["disposition"]


class TestJobEndpoints:
    """ジョブ管理エンドポイントのテスト"""

    def test_get_job_returns_404_when_not_found(self, client):
        """存在しないジョブは 404 を返す"""
        with patch("lib.job_service.get_job", return_value=None):
            response = client.get("/api/jobs/nonexistent")
            assert response.status_code == 404
            assert "Job not found" in response.json()["detail"]

    def test_get_job_returns_job_info(self, client):
        """ジョブ情報を返す"""
        mock_job = {
            "job_id": "abc123",
            "status": "pending",
            "effect_chain": [{"name": "Reverb", "params": {}}],
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-15T10:30:00Z",
        }
        with patch("lib.job_service.get_job", return_value=mock_job):
            response = client.get("/api/jobs/abc123")
            assert response.status_code == 200
            data = response.json()
            assert data["job_id"] == "abc123"
            assert data["status"] == "pending"

    def test_get_job_includes_download_url_when_completed(self, client):
        """完了したジョブはダウンロードURLを含む"""
        mock_job = {
            "job_id": "abc123",
            "status": "completed",
            "output_key": "output/result.wav",
            "effect_chain": [],
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-15T10:31:00Z",
            "completed_at": "2024-01-15T10:31:00Z",
        }
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://s3.example.com/download"

        with (
            patch("lib.job_service.get_job", return_value=mock_job),
            patch("api.routes.S3_BUCKET", "test-bucket"),
            patch("api.routes.get_s3_client", return_value=mock_s3),
        ):
            response = client.get("/api/jobs/abc123")
            assert response.status_code == 200
            data = response.json()
            assert data["download_url"] is not None

    def test_batch_get_jobs_returns_empty_for_empty_request(self, client):
        """空のリクエストに対して空のリストを返す"""
        response = client.post("/api/jobs/batch", json={"job_ids": []})
        assert response.status_code == 200
        data = response.json()
        assert data["jobs"] == []

    def test_batch_get_jobs_returns_jobs(self, client):
        """複数ジョブを返す"""
        mock_jobs = [
            {
                "job_id": "abc123",
                "status": "completed",
                "effect_chain": [],
                "created_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-01-15T10:31:00Z",
            },
            {
                "job_id": "def456",
                "status": "pending",
                "effect_chain": [],
                "created_at": "2024-01-15T10:32:00Z",
                "updated_at": "2024-01-15T10:32:00Z",
            },
        ]
        with patch("lib.job_service.get_jobs_batch", return_value=mock_jobs):
            response = client.post(
                "/api/jobs/batch", json={"job_ids": ["abc123", "def456"]}
            )
            assert response.status_code == 200
            data = response.json()
            assert len(data["jobs"]) == 2


class TestS3ProcessAsync:
    """S3 非同期処理のテスト"""

    def test_s3_process_fails_without_async_config(self, client):
        """非同期設定がない場合は 500 を返す"""
        with (
            patch("api.routes.S3_BUCKET", "test-bucket"),
            patch("api.routes.ASYNC_PROCESSING_ENABLED", False),
        ):
            response = client.post(
                "/api/s3-process",
                json={"s3_key": "input/test.wav", "effect_chain": []},
            )
            assert response.status_code == 500
            assert "Async processing not configured" in response.json()["detail"]

    def test_s3_process_returns_job_id(self, client):
        """非同期処理でジョブIDを返す"""
        mock_job = {
            "job_id": "abc123",
            "status": "pending",
        }

        with (
            patch("api.routes.S3_BUCKET", "test-bucket"),
            patch("api.routes.ASYNC_PROCESSING_ENABLED", True),
            patch("lib.job_service.create_job", return_value=mock_job),
            patch("lib.sqs.send_job_message", return_value=True),
        ):
            response = client.post(
                "/api/s3-process",
                json={
                    "s3_key": "input/test.wav",
                    "effect_chain": [{"name": "Reverb", "params": {}}],
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["job_id"] == "abc123"
            assert data["status"] == "pending"

    def test_s3_process_fails_when_sqs_send_fails(self, client):
        """SQS送信失敗時は 500 を返す"""
        mock_job = {"job_id": "abc123", "status": "pending"}

        with (
            patch("api.routes.S3_BUCKET", "test-bucket"),
            patch("api.routes.ASYNC_PROCESSING_ENABLED", True),
            patch("lib.job_service.create_job", return_value=mock_job),
            patch("lib.sqs.send_job_message", return_value=False),
        ):
            response = client.post(
                "/api/s3-process",
                json={"s3_key": "input/test.wav", "effect_chain": []},
            )
            assert response.status_code == 500
            assert "Failed to queue job" in response.json()["detail"]
