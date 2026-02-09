from unittest.mock import MagicMock, patch

from lib.dynamodb import (
    batch_get_items,
    get_item,
    get_table,
    put_item,
    query_by_gsi,
    update_item,
)


class TestGetTable:
    """get_table のテスト"""

    @patch("lib.dynamodb.get_dynamodb_resource")
    def test_returns_table(self, mock_get_resource):
        """テーブルを返す"""
        mock_dynamodb = MagicMock()
        mock_table = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_get_resource.return_value = mock_dynamodb

        result = get_table()

        assert result == mock_table
        mock_dynamodb.Table.assert_called_once()


class TestPutItem:
    """put_item のテスト"""

    @patch("lib.dynamodb.get_table")
    def test_returns_true_on_success(self, mock_get_table):
        """成功時にTrueを返す"""
        mock_table = MagicMock()
        mock_get_table.return_value = mock_table

        result = put_item({"PK": "test", "SK": "meta"})

        assert result is True
        mock_table.put_item.assert_called_once_with(Item={"PK": "test", "SK": "meta"})

    @patch("lib.dynamodb.get_table")
    def test_returns_false_on_error(self, mock_get_table):
        """エラー時にFalseを返す"""
        from botocore.exceptions import ClientError

        mock_table = MagicMock()
        mock_table.put_item.side_effect = ClientError(
            {"Error": {"Code": "500", "Message": "Error"}}, "put_item"
        )
        mock_get_table.return_value = mock_table

        result = put_item({"PK": "test", "SK": "meta"})

        assert result is False


class TestGetItem:
    """get_item のテスト"""

    @patch("lib.dynamodb.get_table")
    def test_returns_item_when_exists(self, mock_get_table):
        """アイテムが存在する場合に返す"""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {"Item": {"PK": "test", "data": "value"}}
        mock_get_table.return_value = mock_table

        result = get_item("test", "meta")

        assert result == {"PK": "test", "data": "value"}
        mock_table.get_item.assert_called_once_with(Key={"PK": "test", "SK": "meta"})

    @patch("lib.dynamodb.get_table")
    def test_returns_none_when_not_exists(self, mock_get_table):
        """アイテムが存在しない場合にNoneを返す"""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_get_table.return_value = mock_table

        result = get_item("nonexistent", "meta")

        assert result is None

    @patch("lib.dynamodb.get_table")
    def test_returns_none_on_error(self, mock_get_table):
        """エラー時にNoneを返す"""
        from botocore.exceptions import ClientError

        mock_table = MagicMock()
        mock_table.get_item.side_effect = ClientError(
            {"Error": {"Code": "500", "Message": "Error"}}, "get_item"
        )
        mock_get_table.return_value = mock_table

        result = get_item("test", "meta")

        assert result is None


class TestUpdateItem:
    """update_item のテスト"""

    @patch("lib.dynamodb.get_table")
    def test_returns_true_on_success(self, mock_get_table):
        """成功時にTrueを返す"""
        mock_table = MagicMock()
        mock_get_table.return_value = mock_table

        result = update_item("pk", "sk", "SET #attr = :val", {":val": "new"})

        assert result is True
        mock_table.update_item.assert_called_once()

    @patch("lib.dynamodb.get_table")
    def test_returns_false_on_error(self, mock_get_table):
        """エラー時にFalseを返す"""
        from botocore.exceptions import ClientError

        mock_table = MagicMock()
        mock_table.update_item.side_effect = ClientError(
            {"Error": {"Code": "500", "Message": "Error"}}, "update_item"
        )
        mock_get_table.return_value = mock_table

        result = update_item("pk", "sk", "SET #attr = :val", {":val": "new"})

        assert result is False


class TestBatchGetItems:
    """batch_get_items のテスト"""

    @patch("lib.dynamodb.get_dynamodb_resource")
    @patch("lib.dynamodb.DYNAMODB_TABLE", "test-table")
    def test_returns_items(self, mock_get_resource):
        """アイテムを返す"""
        mock_dynamodb = MagicMock()
        mock_dynamodb.batch_get_item.return_value = {
            "Responses": {"test-table": [{"PK": "1"}, {"PK": "2"}]}
        }
        mock_get_resource.return_value = mock_dynamodb

        keys = [{"PK": "1", "SK": "meta"}, {"PK": "2", "SK": "meta"}]
        result = batch_get_items(keys)

        assert len(result) == 2

    def test_returns_empty_for_empty_keys(self):
        """空のキーリストに対して空を返す"""
        result = batch_get_items([])

        assert result == []

    @patch("lib.dynamodb.get_dynamodb_resource")
    def test_returns_empty_on_error(self, mock_get_resource):
        """エラー時に空を返す"""
        from botocore.exceptions import ClientError

        mock_dynamodb = MagicMock()
        mock_dynamodb.batch_get_item.side_effect = ClientError(
            {"Error": {"Code": "500", "Message": "Error"}}, "batch_get_item"
        )
        mock_get_resource.return_value = mock_dynamodb

        result = batch_get_items([{"PK": "1", "SK": "meta"}])

        assert result == []


class TestQueryByGsi:
    """query_by_gsi のテスト"""

    @patch("lib.dynamodb.get_table")
    def test_returns_items(self, mock_get_table):
        """アイテムを返す"""
        mock_table = MagicMock()
        mock_table.query.return_value = {"Items": [{"job_id": "1"}, {"job_id": "2"}]}
        mock_get_table.return_value = mock_table

        result = query_by_gsi("GSI1", "STATUS#pending")

        assert len(result) == 2
        mock_table.query.assert_called_once()

    @patch("lib.dynamodb.get_table")
    def test_returns_empty_on_error(self, mock_get_table):
        """エラー時に空を返す"""
        from botocore.exceptions import ClientError

        mock_table = MagicMock()
        mock_table.query.side_effect = ClientError(
            {"Error": {"Code": "500", "Message": "Error"}}, "query"
        )
        mock_get_table.return_value = mock_table

        result = query_by_gsi("GSI1", "STATUS#pending")

        assert result == []
