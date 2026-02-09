from unittest.mock import MagicMock, patch

import pytest

from lib.job_service import (
    create_job,
    generate_job_id,
    get_job,
    get_jobs_batch,
    mark_job_completed,
    mark_job_failed,
    mark_job_processing,
)


class TestGenerateJobId:
    """ジョブID生成のテスト"""

    def test_returns_32_char_hex_string(self):
        """32文字の16進数文字列を返す"""
        job_id = generate_job_id()
        assert len(job_id) == 32
        assert all(c in "0123456789abcdef" for c in job_id)

    def test_returns_unique_ids(self):
        """ユニークなIDを生成する"""
        ids = [generate_job_id() for _ in range(100)]
        assert len(set(ids)) == 100


class TestCreateJob:
    """ジョブ作成のテスト"""

    @patch("lib.job_service.put_item")
    def test_creates_job_with_correct_structure(self, mock_put_item):
        """正しい構造でジョブを作成する"""
        mock_put_item.return_value = True

        job = create_job(
            input_key="input/test.wav",
            effect_chain=[{"name": "Reverb", "params": {}}],
            original_filename="test.wav",
        )

        assert job["status"] == "pending"
        assert job["input_key"] == "input/test.wav"
        assert job["effect_chain"] == [{"name": "Reverb", "params": {}}]
        assert job["original_filename"] == "test.wav"
        assert job["output_key"] is None
        assert job["error_message"] is None
        assert "job_id" in job
        assert "created_at" in job
        assert "expires_at" in job
        assert job["PK"] == f"JOB#{job['job_id']}"
        assert job["SK"] == "META"
        assert job["GSI1PK"] == "STATUS#pending"

    @patch("lib.job_service.put_item")
    def test_raises_on_put_failure(self, mock_put_item):
        """put_item失敗時に例外を発生させる"""
        mock_put_item.return_value = False

        with pytest.raises(RuntimeError, match="Failed to create job"):
            create_job("input/test.wav", [])


class TestGetJob:
    """ジョブ取得のテスト"""

    @patch("lib.job_service.get_item")
    def test_returns_job_when_exists(self, mock_get_item):
        """ジョブが存在する場合に返す"""
        mock_job = {"job_id": "abc123", "status": "pending"}
        mock_get_item.return_value = mock_job

        result = get_job("abc123")

        assert result == mock_job
        mock_get_item.assert_called_once_with("JOB#abc123", "META")

    @patch("lib.job_service.get_item")
    def test_returns_none_when_not_exists(self, mock_get_item):
        """ジョブが存在しない場合にNoneを返す"""
        mock_get_item.return_value = None

        result = get_job("nonexistent")

        assert result is None


class TestGetJobsBatch:
    """バッチ取得のテスト"""

    @patch("lib.job_service.batch_get_items")
    def test_returns_jobs_for_valid_ids(self, mock_batch_get):
        """有効なIDのジョブを返す"""
        mock_jobs = [
            {"job_id": "abc123", "status": "completed"},
            {"job_id": "def456", "status": "pending"},
        ]
        mock_batch_get.return_value = mock_jobs

        result = get_jobs_batch(["abc123", "def456"])

        assert result == mock_jobs
        mock_batch_get.assert_called_once()

    @patch("lib.job_service.batch_get_items")
    def test_returns_empty_for_empty_input(self, mock_batch_get):
        """空の入力に対して空を返す"""
        result = get_jobs_batch([])

        assert result == []
        mock_batch_get.assert_not_called()


class TestUpdateJobStatus:
    """ステータス更新のテスト"""

    @patch("lib.dynamodb.get_table")
    def test_mark_job_processing(self, mock_get_table):
        """処理中ステータスに更新する"""
        mock_table = MagicMock()
        mock_get_table.return_value = mock_table

        result = mark_job_processing("abc123")

        assert result is True
        mock_table.update_item.assert_called_once()
        call_args = mock_table.update_item.call_args
        assert call_args.kwargs["Key"] == {"PK": "JOB#abc123", "SK": "META"}
        assert ":status" in call_args.kwargs["ExpressionAttributeValues"]
        assert call_args.kwargs["ExpressionAttributeValues"][":status"] == "processing"

    @patch("lib.dynamodb.get_table")
    def test_mark_job_completed(self, mock_get_table):
        """完了ステータスに更新する"""
        mock_table = MagicMock()
        mock_get_table.return_value = mock_table

        result = mark_job_completed("abc123", "output/result.wav")

        assert result is True
        call_args = mock_table.update_item.call_args
        values = call_args.kwargs["ExpressionAttributeValues"]
        assert values[":status"] == "completed"
        assert values[":output_key"] == "output/result.wav"
        assert ":completed_at" in values

    @patch("lib.dynamodb.get_table")
    def test_mark_job_failed(self, mock_get_table):
        """失敗ステータスに更新する"""
        mock_table = MagicMock()
        mock_get_table.return_value = mock_table

        result = mark_job_failed("abc123", "Processing error")

        assert result is True
        call_args = mock_table.update_item.call_args
        values = call_args.kwargs["ExpressionAttributeValues"]
        assert values[":status"] == "failed"
        assert values[":error_message"] == "Processing error"

    @patch("lib.dynamodb.get_table")
    def test_returns_false_on_update_error(self, mock_get_table):
        """更新エラー時にFalseを返す"""
        mock_table = MagicMock()
        mock_table.update_item.side_effect = Exception("DynamoDB error")
        mock_get_table.return_value = mock_table

        result = mark_job_processing("abc123")

        assert result is False
