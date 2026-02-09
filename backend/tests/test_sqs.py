import json
from unittest.mock import MagicMock, patch

import pytest

from lib.sqs import parse_sqs_message, send_job_message


class TestSendJobMessage:
    """send_job_message のテスト"""

    @patch("lib.sqs.get_sqs_client")
    @patch("lib.sqs.SQS_QUEUE_URL", "https://sqs.example.com/queue")
    def test_sends_message_successfully(self, mock_get_client):
        """メッセージを正常に送信する"""
        mock_sqs = MagicMock()
        mock_get_client.return_value = mock_sqs

        result = send_job_message(
            job_id="job123",
            input_key="input/test.wav",
            effect_chain=[{"name": "Reverb", "params": {}}],
            original_filename="test.wav",
        )

        assert result is True
        mock_sqs.send_message.assert_called_once()
        call_args = mock_sqs.send_message.call_args
        assert call_args.kwargs["QueueUrl"] == "https://sqs.example.com/queue"

        # メッセージ本文を検証
        body = json.loads(call_args.kwargs["MessageBody"])
        assert body["job_id"] == "job123"
        assert body["input_key"] == "input/test.wav"
        assert body["effect_chain"] == [{"name": "Reverb", "params": {}}]
        assert body["original_filename"] == "test.wav"

    @patch("lib.sqs.SQS_QUEUE_URL", "")
    def test_raises_error_when_queue_url_not_configured(self):
        """キューURLが設定されていない場合は例外を発生させる"""
        with pytest.raises(RuntimeError, match="SQS_QUEUE_URL is not configured"):
            send_job_message("job123", "input/test.wav", [])

    @patch("lib.sqs.get_sqs_client")
    @patch("lib.sqs.SQS_QUEUE_URL", "https://sqs.example.com/queue")
    def test_returns_false_on_client_error(self, mock_get_client):
        """ClientError時にFalseを返す"""
        from botocore.exceptions import ClientError

        mock_sqs = MagicMock()
        mock_sqs.send_message.side_effect = ClientError(
            {"Error": {"Code": "500", "Message": "Error"}}, "send_message"
        )
        mock_get_client.return_value = mock_sqs

        result = send_job_message("job123", "input/test.wav", [])

        assert result is False

    @patch("lib.sqs.get_sqs_client")
    @patch("lib.sqs.SQS_QUEUE_URL", "https://sqs.example.com/queue.fifo")
    def test_includes_message_group_id_for_fifo_queue(self, mock_get_client):
        """FIFOキューの場合はMessageGroupIdを含める"""
        mock_sqs = MagicMock()
        mock_get_client.return_value = mock_sqs

        send_job_message("job123", "input/test.wav", [])

        call_args = mock_sqs.send_message.call_args
        assert call_args.kwargs["MessageGroupId"] == "job123"

    @patch("lib.sqs.get_sqs_client")
    @patch("lib.sqs.SQS_QUEUE_URL", "https://sqs.example.com/queue")
    def test_does_not_include_message_group_id_for_standard_queue(self, mock_get_client):
        """標準キューの場合はMessageGroupIdを含めない"""
        mock_sqs = MagicMock()
        mock_get_client.return_value = mock_sqs

        send_job_message("job123", "input/test.wav", [])

        call_args = mock_sqs.send_message.call_args
        assert "MessageGroupId" not in call_args.kwargs


class TestParseSqsMessage:
    """parse_sqs_message のテスト"""

    def test_parses_valid_message(self):
        """有効なメッセージを解析する"""
        record = {
            "body": json.dumps(
                {
                    "job_id": "job123",
                    "input_key": "input/test.wav",
                    "effect_chain": [{"name": "Reverb"}],
                }
            )
        }

        result = parse_sqs_message(record)

        assert result["job_id"] == "job123"
        assert result["input_key"] == "input/test.wav"
        assert result["effect_chain"] == [{"name": "Reverb"}]

    def test_returns_empty_dict_for_empty_body(self):
        """空のbodyに対して空の辞書を返す"""
        record = {"body": "{}"}

        result = parse_sqs_message(record)

        assert result == {}

    def test_returns_empty_dict_for_missing_body(self):
        """bodyがない場合は空の辞書を返す"""
        record = {}

        result = parse_sqs_message(record)

        assert result == {}
