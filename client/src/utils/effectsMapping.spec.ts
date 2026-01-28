import { describe, expect, it } from 'vitest';
import {
  createInitialEffects,
  DEFAULT_PARAMS,
  EFFECT_IMAGES,
  effectsToChain,
} from './effectsMapping';

describe('effectsMapping', () => {
  describe('createInitialEffects', () => {
    it('すべてのエフェクトを生成する', () => {
      const effects = createInitialEffects();
      expect(effects).toHaveLength(Object.keys(EFFECT_IMAGES).length);
    });

    it('すべてのエフェクトが無効状態で生成される', () => {
      const effects = createInitialEffects();
      for (const effect of effects) {
        expect(effect.enabled).toBe(false);
      }
    });

    it('各エフェクトにデフォルトパラメータが設定される', () => {
      const effects = createInitialEffects();
      const booster = effects.find((e) => e.name === 'Booster_Preamp');
      expect(booster?.params).toEqual(DEFAULT_PARAMS.Booster_Preamp);
    });

    it('各エフェクトに一意のIDが設定される', () => {
      const effects = createInitialEffects();
      const ids = effects.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(effects.length);
    });
  });

  describe('effectsToChain', () => {
    it('有効なエフェクトのみを返す', () => {
      const effects = createInitialEffects();
      effects[0].enabled = true;
      effects[2].enabled = true;

      const chain = effectsToChain(effects);
      expect(chain).toHaveLength(2);
    });

    it('すべて無効の場合は空配列を返す', () => {
      const effects = createInitialEffects();
      const chain = effectsToChain(effects);
      expect(chain).toEqual([]);
    });

    it('エフェクト名とパラメータを含む', () => {
      const effects = createInitialEffects();
      effects[0].enabled = true;

      const chain = effectsToChain(effects);
      expect(chain[0]).toHaveProperty('name');
      expect(chain[0]).toHaveProperty('params');
    });
  });
});
