from pedalboard import Pedalboard

from lib import EFFECT_MAPPING, build_effect_chain, get_default_effect_chain


class TestEffects:
    """lib/effects.py のテスト"""

    def test_all_effects_have_valid_class(self):
        """全エフェクトが有効なクラスを持つ"""
        for name, config in EFFECT_MAPPING.items():
            assert callable(config["class"]), f"{name} の class が callable でない"

    def test_get_default_effect_chain(self):
        """デフォルトエフェクトチェーンの取得"""
        board = get_default_effect_chain()
        assert isinstance(board, Pedalboard)
        assert len(board) == 5  # Gain, Compressor, Distortion, Chorus, Reverb

    def test_build_effect_chain_preserves_order(self):
        """エフェクトの順序が保持される"""
        effects = [
            {"name": "Chorus"},
            {"name": "Delay"},
            {"name": "Reverb"},
        ]
        board = build_effect_chain(effects)
        assert len(board) == 3
