import json
from unittest.mock import MagicMock, patch

import pytest


class TestWorkerHandler:
    """ワーカーLambdaハンドラーのテスト"""

    @patch("worker.handler.mark_job_completed")
    @patch("worker.handler.mark_job_processing")
    @patch("worker.handler.process_audio_file")
    @patch("worker.handler.parse_sqs_message")
    def test_processes_message_successfully(
        self,
        mock_parse,
        mock_process,
        mock_processing,
        mock_completed,
    ):
        """メッセージを正常に処理する"""
        from worker.handler import handler

        mock_parse.return_value = {
            "job_id": "job123",
            "input_key": "input/test.wav",
            "effect_chain": [{"name": "Reverb"}],
        }
        mock_process.return_value = ("output/result.wav", "norm/input.wav", "norm/output.wav")

        event = {"Records": [{"body": json.dumps({"job_id": "job123"})}]}

        result = handler(event, None)

        mock_processing.assert_called_once_with("job123")
        mock_completed.assert_called_once_with("job123", "output/result.wav")
        assert result == {"batchItemFailures": []}

    @patch("worker.handler.mark_job_failed")
    @patch("worker.handler.mark_job_processing")
    @patch("worker.handler.process_audio_file")
    @patch("worker.handler.parse_sqs_message")
    def test_marks_job_failed_on_processing_error(
        self,
        mock_parse,
        mock_process,
        mock_processing,
        mock_failed,
    ):
        """処理エラー時にジョブを失敗にする"""
        from worker.handler import handler

        mock_parse.return_value = {
            "job_id": "job123",
            "input_key": "input/test.wav",
            "effect_chain": [],
        }
        mock_process.side_effect = Exception("Processing failed")

        event = {"Records": [{"body": json.dumps({"job_id": "job123"})}]}

        handler(event, None)

        mock_failed.assert_called_once()
        assert "Processing failed" in mock_failed.call_args[0][1]

    @patch("worker.handler.parse_sqs_message")
    def test_skips_message_without_job_id(self, mock_parse):
        """job_idがないメッセージはスキップする"""
        from worker.handler import handler

        mock_parse.return_value = {"input_key": "input/test.wav"}

        event = {"Records": [{"body": "{}"}]}

        result = handler(event, None)

        assert result == {"batchItemFailures": []}

    @patch("worker.handler.parse_sqs_message")
    def test_skips_message_without_input_key(self, mock_parse):
        """input_keyがないメッセージはスキップする"""
        from worker.handler import handler

        mock_parse.return_value = {"job_id": "job123"}

        event = {"Records": [{"body": "{}"}]}

        result = handler(event, None)

        assert result == {"batchItemFailures": []}

    def test_handles_empty_records(self):
        """空のレコードを処理する"""
        from worker.handler import handler

        event = {"Records": []}

        result = handler(event, None)

        assert result == {"batchItemFailures": []}


class TestProcessAudioFile:
    """process_audio_file のテスト"""

    @patch("worker.handler.get_s3_client")
    @patch("worker.handler.S3_BUCKET", "test-bucket")
    def test_processes_audio_and_uploads(self, mock_get_s3, tmp_path):
        """音声を処理してS3にアップロードする"""
        import numpy as np
        from pedalboard.io import AudioFile

        from worker.handler import process_audio_file

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
        mock_get_s3.return_value = mock_s3

        output_key, input_norm_key, output_norm_key = process_audio_file(
            "input/test.wav", [{"name": "Reverb", "params": {}}]
        )

        assert output_key.startswith("output/")
        assert "normalized" in input_norm_key
        assert "normalized" in output_norm_key
        assert mock_s3.upload_file.call_count == 3  # output + 2 normalized

    @patch("worker.handler.get_s3_client")
    @patch("worker.handler.S3_BUCKET", "test-bucket")
    def test_raises_on_s3_download_error(self, mock_get_s3):
        """S3ダウンロードエラー時に例外を発生させる"""
        from botocore.exceptions import ClientError

        from worker.handler import process_audio_file

        mock_s3 = MagicMock()
        mock_s3.download_file.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}}, "download_file"
        )
        mock_get_s3.return_value = mock_s3

        with pytest.raises(ClientError):
            process_audio_file("input/nonexistent.wav", [])
