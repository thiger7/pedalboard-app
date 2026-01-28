import type { Effect } from '../types/effects';

// 画像ファイル名とエフェクト名のマッピング
export const EFFECT_IMAGES: Record<string, string> = {
  Booster_Preamp: '/images/generated/Booster_Preamp.png',
  'Blues Driver': '/images/generated/Blues Driver.png',
  'SUPER OverDrive': '/images/generated/SUPER OverDrive.png',
  Distortion: '/images/generated/Distortion.png',
  Fuzz: '/images/generated/Fuzz.png',
  'Metal Zone': '/images/generated/Metal Zone.png',
  'Heavy Metal': '/images/generated/Heavy Metal.png',
  Chorus: '/images/generated/Chorus.png',
  Dimension: '/images/generated/Dimension.png',
  Vibrato: '/images/generated/Vibrato.png',
  Delay: '/images/generated/Delay.png',
};

// デフォルトパラメータ（BOSS実機の音響特性に準拠）
export const DEFAULT_PARAMS: Record<string, Record<string, number>> = {
  Booster_Preamp: { gain_db: 6 },
  'Blues Driver': { drive_db: 10 },
  'SUPER OverDrive': { drive_db: 15 },
  Distortion: { drive_db: 22 },
  Fuzz: { drive_db: 28 },
  'Metal Zone': { drive_db: 30 },
  'Heavy Metal': { drive_db: 35 },
  Chorus: { rate_hz: 1.0, depth: 0.25 },
  Dimension: { rate_hz: 0.5, depth: 0.15 },
  Vibrato: { rate_hz: 5.0, depth: 0.5, mix: 1.0 },
  Delay: { delay_seconds: 0.35, feedback: 0.4 },
};

// 初期エフェクトリスト（未選択状態）
export function createInitialEffects(): Effect[] {
  return Object.entries(EFFECT_IMAGES).map(([name, image], index) => ({
    id: `effect-${index}`,
    name,
    image,
    enabled: false,
    params: { ...DEFAULT_PARAMS[name] },
    defaultParams: { ...DEFAULT_PARAMS[name] },
  }));
}

// エフェクトをAPIリクエスト用の形式に変換
export function effectsToChain(
  effects: Effect[],
): { name: string; params?: Record<string, number> }[] {
  return effects
    .filter((e) => e.enabled)
    .map((e) => ({
      name: e.name,
      params: e.params,
    }));
}
