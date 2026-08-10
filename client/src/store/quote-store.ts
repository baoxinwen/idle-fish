/**
 * 报价状态 store。
 * 持有当前编辑的 QuoteInput（实时试算由组件 useMemo 调用 calcQuote 完成）。
 */

import { create } from 'zustand';
import {
  type AccessoryCategory,
  type AccessoryItem,
  type PricingParams,
  type ProfileColor,
  type QuoteInput,
  type QuoteStatus,
  type Settings,
  DEFAULT_SETTINGS,
} from '@idlefish/shared';

interface QuoteStoreState {
  /** 当前编辑的报价输入 */
  input: QuoteInput;
  /** 编辑模式下的报价 ID（新建时为 null） */
  editingId: string | null;
  /** 编辑模式下报价的状态（新建时为 null） */
  editingStatus: QuoteStatus | null;
  /** 是否已从设置加载默认值 */
  initialized: boolean;

  /** 从已有报价记录加载（编辑模式） */
  loadFromRecord: (input: QuoteInput, id: string, status: QuoteStatus) => void;
  /** 重置为新建状态（用默认设置） */
  reset: (settings: Settings) => void;
  /** 标记正在加载（路由切换时设 initialized=false，让 LoadingState 接管） */
  markLoading: () => void;

  // 尺寸
  setSize: (field: 'width' | 'depth' | 'height', value: number) => void;
  // 颜色
  setColor: (color: ProfileColor) => void;
  // 托盘
  setTrayCount: (count: number) => void;
  setTrayUnitPrice: (price: number) => void;
  // 安装费勾选
  toggleInstall: (enabled: boolean) => void;
  // 运费勾选
  toggleFreight: (enabled: boolean) => void;

  // 配件
  updateAccessory: (index: number, patch: Partial<AccessoryItem>) => void;
  addAccessory: (item: AccessoryItem) => void;
  removeAccessory: (index: number) => void;

  // 计价参数
  setPricing: (patch: Partial<PricingParams>) => void;
  /** 恢复计价参数到设置默认值 */
  resetPricingFromSettings: (settings: Settings) => void;
}

// 初始占位 input，从 DEFAULT_SETTINGS 派生（避免手抄默认值导致不同步）
const DEFAULT_INPUT: QuoteInput = {
  size: { ...DEFAULT_SETTINGS.defaultSize },
  color: DEFAULT_SETTINGS.defaultColor,
  trayCount: DEFAULT_SETTINGS.defaultTrayCount,
  trayUnitPrice: 0,
  installEnabled: false,
  freightEnabled: false,
  accessories: [],
  pricing: { ...DEFAULT_SETTINGS.defaultPricing },
};

/** 从设置构建初始 QuoteInput（带默认配件展开，托盘作为 tray 配件项） */
function inputFromSettings(settings: Settings): QuoteInput {
  const accessories: AccessoryItem[] = settings.defaultAccessories.map((a) => ({
    name: a.name,
    category: a.category as AccessoryCategory,
    quantity: a.defaultQuantity,
    unitPrice: a.defaultUnitPrice,
  }));
  // 托盘作为配件：若默认配件里没有 tray 项，用 defaultTrayCount/UnitPrice 补一个
  if (!accessories.some((a) => a.category === 'tray')) {
    accessories.push({
      name: '托盘',
      category: 'tray',
      quantity: settings.defaultTrayCount,
      unitPrice: settings.defaultTrayUnitPrice ?? 0,
    });
  }
  const trayItem = accessories.find((a) => a.category === 'tray')!;
  return {
    size: { ...settings.defaultSize },
    color: settings.defaultColor,
    trayCount: trayItem.quantity,
    trayUnitPrice: trayItem.unitPrice,
    installEnabled: false,
    freightEnabled: false,
    accessories,
    pricing: { ...settings.defaultPricing },
  };
}

export const useQuoteStore = create<QuoteStoreState>((set) => ({
  input: DEFAULT_INPUT,
  editingId: null,
  editingStatus: null,
  initialized: false,

  loadFromRecord: (input, id, status) => {
    // 旧记录（freightEnabled 字段引入前）无此字段，兜底为 true 保持原行为（运费总是计入）
    const normalized: QuoteInput = {
      ...structuredClone(input),
      freightEnabled: input.freightEnabled ?? true,
    };
    set({ input: normalized, editingId: id, editingStatus: status, initialized: true });
  },

  reset: (settings) => set({ input: inputFromSettings(settings), editingId: null, editingStatus: null, initialized: true }),

  markLoading: () => set({ initialized: false }),

  setSize: (field, value) =>
    set((s) => ({ input: { ...s.input, size: { ...s.input.size, [field]: value } } })),

  setColor: (color) => set((s) => ({ input: { ...s.input, color } })),

  setTrayCount: (trayCount) =>
    set((s) => ({
      input: {
        ...s.input,
        trayCount,
        accessories: s.input.accessories.map((a) => (a.category === 'tray' ? { ...a, quantity: trayCount } : a)),
      },
    })),

  setTrayUnitPrice: (trayUnitPrice) =>
    set((s) => ({
      input: {
        ...s.input,
        trayUnitPrice,
        accessories: s.input.accessories.map((a) => (a.category === 'tray' ? { ...a, unitPrice: trayUnitPrice } : a)),
      },
    })),

  toggleInstall: (installEnabled) => set((s) => ({ input: { ...s.input, installEnabled } })),

  toggleFreight: (freightEnabled) => set((s) => ({ input: { ...s.input, freightEnabled } })),

  updateAccessory: (index, patch) =>
    set((s) => {
      const accessories = s.input.accessories.map((a, i) => (i === index ? { ...a, ...patch } : a));
      return { input: { ...s.input, accessories } };
    }),

  addAccessory: (item) =>
    set((s) => ({ input: { ...s.input, accessories: [...s.input.accessories, item] } })),

  removeAccessory: (index) =>
    set((s) => ({
      input: { ...s.input, accessories: s.input.accessories.filter((_, i) => i !== index) },
    })),

  setPricing: (patch) =>
    set((s) => ({ input: { ...s.input, pricing: { ...s.input.pricing, ...patch } } })),

  resetPricingFromSettings: (settings) =>
    set((s) => ({ input: { ...s.input, pricing: { ...settings.defaultPricing } } })),
}));
