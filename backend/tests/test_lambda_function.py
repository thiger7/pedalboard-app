import json

from pedalboard import Pedalboard

from lambda_function import handler
from lib import EFFECT_MAPPING, build_effect_chain


class TestEffectMapping:
    """EFFECT_MAPPING のテスト"""

    def test_effect_mapping_has_expected_effects(self):
        """期待するエフェクトが定義されている"""
        expected = ["Booster_Preamp", "Blues Driver", "Distortion", "Chorus", "Delay"]
        for effect in expected:
            assert effect in EFFECT_MAPPING

    def test_effect_mapping_has_class_and_params(self):
        """各エフェクトに class と params が定義されている"""
        for name, config in EFFECT_MAPPING.items():
            assert "class" in config, f"{name} に class がない"
            assert "params" in config, f"{name} に params がない"


class TestBuildEffectChain:
    """build_effect_chain のテスト"""

    def test_empty_list_returns_empty_pedalboard(self):
        """空のリストで空の Pedalboard を返す"""
        board = build_effect_chain([])
        assert isinstance(board, Pedalboard)
        assert len(board) == 0

    def test_single_effect(self):
        """単一エフェクトの構築"""
        board = build_effect_chain([{"name": "Blues Driver"}])
        assert len(board) == 1

    def test_multiple_effects(self):
        """複数エフェクトの構築"""
        board = build_effect_chain(
            [
                {"name": "Blues Driver"},
                {"name": "Chorus"},
            ]
        )
        assert len(board) == 2

    def test_custom_params_override_defaults(self):
        """カスタムパラメータがデフォルトを上書きする"""
        board = build_effect_chain([{"name": "Booster_Preamp", "params": {"gain_db": 12}}])
        assert len(board) == 1
        assert board[0].gain_db == 12

    def test_unknown_effect_is_skipped(self):
        """未知のエフェクトはスキップされる"""
        board = build_effect_chain(
            [
                {"name": "Unknown Effect"},
                {"name": "Chorus"},
            ]
        )
        assert len(board) == 1


class TestHandler:
    """handler のテスト"""

    def test_handler_is_mangum_instance(self):
        """handler が Mangum インスタンスである"""
        from mangum import Mangum

        assert isinstance(handler, Mangum)

    def test_handler_with_api_gateway_event(self):
        """API Gateway 形式のイベントを処理できる"""
        event = {
            "version": "2.0",
            "routeKey": "GET /api/health",
            "rawPath": "/api/health",
            "rawQueryString": "",
            "headers": {
                "host": "localhost",
                "content-type": "application/json",
            },
            "requestContext": {
                "accountId": "123456789012",
                "apiId": "api-id",
                "domainName": "localhost",
                "domainPrefix": "localhost",
                "http": {
                    "method": "GET",
                    "path": "/api/health",
                    "protocol": "HTTP/1.1",
                    "sourceIp": "127.0.0.1",
                    "userAgent": "test",
                },
                "requestId": "request-id",
                "routeKey": "GET /api/health",
                "stage": "$default",
                "time": "01/Jan/2024:00:00:00 +0000",
                "timeEpoch": 1704067200000,
            },
            "isBase64Encoded": False,
        }

        result = handler(event, None)
        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert body["status"] == "ok"
