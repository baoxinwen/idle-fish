/**
 * 设置 store：加载/保存 settings，编辑默认尺寸、计价参数、配件配置。
 */

import { create } from 'zustand';
import {
  type CabinetSize,
  type DefaultAccessoryConfig,
  type PricingParams,
  type ProfileColor,
  type Settings,
} from '@idlefish/shared';

interface SettingsStoreState {
  settings: Settings | null;
  loaded: boolean;
  dirty: boolean;

  load: () => Promise<void>;
  setSettings: (s: Settings) => void;

  setDefaultSize: (field: keyof CabinetSize, value: number) => void;
  setDefaultColor: (color: ProfileColor) => void;
  setDefaultTrayCount: (count: number) => void;
  setPricing: (patch: Partial<PricingParams>) => void;

  addAccessory: () => void;
  updateAccessory: (index: number, patch: Partial<DefaultAccessoryConfig>) => void;
  removeAccessory: (index: number) => void;

  save: () => Promise<void>;
}

import { settingsApi } from '@/lib/api';

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: null,
  loaded: false,
  dirty: false,

  load: async () => {
    const s = await settingsApi.get();
    set({ settings: s, loaded: true, dirty: false });
  },

  setSettings: (s) => set({ settings: s, dirty: true }),

  setDefaultSize: (field, value) =>
    set((s) =>
      s.settings
        ? { settings: { ...s.settings, defaultSize: { ...s.settings.defaultSize, [field]: value } }, dirty: true }
        : {},
    ),

  setDefaultColor: (color) =>
    set((s) => (s.settings ? { settings: { ...s.settings, defaultColor: color }, dirty: true } : {})),

  setDefaultTrayCount: (count) =>
    set((s) => (s.settings ? { settings: { ...s.settings, defaultTrayCount: count }, dirty: true } : {})),

  setPricing: (patch) =>
    set((s) =>
      s.settings
        ? { settings: { ...s.settings, defaultPricing: { ...s.settings.defaultPricing, ...patch } }, dirty: true }
        : {},
    ),

  addAccessory: () =>
    set((s) =>
      s.settings
        ? {
            settings: {
              ...s.settings,
              defaultAccessories: [
                ...s.settings.defaultAccessories,
                { name: '新配件', category: 'custom', defaultQuantity: 0, defaultUnitPrice: 0 },
              ],
            },
            dirty: true,
          }
        : {},
    ),

  updateAccessory: (index, patch) =>
    set((s) =>
      s.settings
        ? {
            settings: {
              ...s.settings,
              defaultAccessories: s.settings.defaultAccessories.map((a, i) =>
                i === index ? { ...a, ...patch } : a,
              ),
            },
            dirty: true,
          }
        : {},
    ),

  removeAccessory: (index) =>
    set((s) =>
      s.settings
        ? {
            settings: {
              ...s.settings,
              defaultAccessories: s.settings.defaultAccessories.filter((_, i) => i !== index),
            },
            dirty: true,
          }
        : {},
    ),

  save: async () => {
    const { settings } = get();
    if (!settings) return;
    await settingsApi.update(settings);
    set({ dirty: false });
  },
}));
