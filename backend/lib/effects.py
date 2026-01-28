from pedalboard import Chorus, Compressor, Delay, Distortion, Gain, Pedalboard, Reverb

# エフェクトマッピング（画像名 → pedalboardクラス + デフォルトパラメータ）
# BOSS実機の音響特性に準拠
EFFECT_MAPPING = {
    # 歪み系（弱→強の順）
    "Booster_Preamp": {"class": Gain, "params": {"gain_db": 6}},
    "Blues Driver": {"class": Distortion, "params": {"drive_db": 10}},
    "SUPER OverDrive": {"class": Distortion, "params": {"drive_db": 15}},
    "Distortion": {"class": Distortion, "params": {"drive_db": 30}},
    "Fuzz": {"class": Distortion, "params": {"drive_db": 33}},
    "Metal Zone": {"class": Distortion, "params": {"drive_db": 36}},
    "Heavy Metal": {"class": Distortion, "params": {"drive_db": 50}},
    # モジュレーション系
    "Chorus": {"class": Chorus, "params": {"rate_hz": 1.0, "depth": 0.25}},
    "Dimension": {"class": Chorus, "params": {"rate_hz": 0.5, "depth": 0.15}},
    "Vibrato": {"class": Chorus, "params": {"rate_hz": 0.3, "depth": 0.5, "mix": 1.0}},
    # 空間系
    "Delay": {"class": Delay, "params": {"delay_seconds": 0.35, "feedback": 0.4}},
    "Reverb": {"class": Reverb, "params": {"room_size": 0.5}},
}


def build_effect_chain(effect_list: list) -> Pedalboard:
    """
    エフェクトリストからPedalboardを構築

    Args:
        effect_list: [{"name": "Blues Driver", "params": {"drive_db": 20}}, ...]

    Returns:
        Pedalboard: 構築されたエフェクトチェーン
    """
    effects = []
    for effect_config in effect_list:
        effect_name = effect_config.get("name")
        custom_params = effect_config.get("params", {})

        if effect_name not in EFFECT_MAPPING:
            continue

        mapping = EFFECT_MAPPING[effect_name]
        effect_class = mapping["class"]
        params = {**mapping["params"], **custom_params}
        effects.append(effect_class(**params))

    return Pedalboard(effects)


def get_default_effect_chain() -> Pedalboard:
    """デフォルトのエフェクトチェーン（後方互換用）"""
    return Pedalboard(
        [
            Gain(gain_db=3.0),
            Compressor(threshold_db=-20, ratio=4),
            Distortion(drive_db=10),
            Chorus(rate_hz=1.0, depth=0.25),
            Reverb(room_size=0.25),
        ]
    )
