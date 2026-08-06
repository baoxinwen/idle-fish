/**
 * 订单编辑状态 store。
 * 支持两种来源：手动新建（create）、编辑已有（load）。
 * 转单（fromQuote）走后端 convert 接口，前端单独表单收集客户/收货信息，不经此 store。
 */

import { create } from 'zustand';
import {
  calcOrderFinance,
  DEFAULT_SETTINGS,
  type AccessoryItem,
  type CabinetSize,
  type CustomerInfo,
  type OrderRecord,
  type Settings,
  type ShippingAddress,
} from '@idlefish/shared';

/** 订单编辑表单（与后端 create/update 入参对齐） */
export interface OrderFormState {
  customer: CustomerInfo;
  shippingAddress: ShippingAddress;
  size: CabinetSize;
  materials: AccessoryItem[];
  materialCost: number;
  otherFee: number;
  actualPrice: number;
  remark: string;
}

const EMPTY_FORM: OrderFormState = {
  customer: { name: '', platformOrderNo: '' },
  shippingAddress: { receiver: '', phone: '', address: '' },
  size: { ...DEFAULT_SETTINGS.defaultSize },
  materials: [],
  materialCost: 0,
  otherFee: 0,
  actualPrice: 0,
  remark: '',
};

interface OrderStoreState {
  form: OrderFormState;
  editingId: string | null;
  initialized: boolean;

  loadFromRecord: (record: OrderRecord) => void;
  /** 重置为新建状态，从设置带出必选配件（连接件/紧固件） */
  reset: (settings: Settings) => void;
  markLoading: () => void;

  setCustomer: (patch: Partial<CustomerInfo>) => void;
  setShippingAddress: (patch: Partial<ShippingAddress>) => void;
  setSize: (field: keyof CabinetSize, value: number) => void;
  setMaterialCost: (v: number) => void;
  setOtherFee: (v: number) => void;
  setActualPrice: (v: number) => void;
  setRemark: (v: string) => void;
  updateMaterial: (index: number, patch: Partial<AccessoryItem>) => void;
  addMaterial: (item: AccessoryItem) => void;
  removeMaterial: (index: number) => void;

  /** 实时财务（预估） */
  computeFinance: () => ReturnType<typeof calcOrderFinance>;
}

export const useOrderStore = create<OrderStoreState>((set, get) => ({
  form: EMPTY_FORM,
  editingId: null,
  initialized: false,

  loadFromRecord: (record) =>
    set({
      form: {
        customer: { ...record.customer },
        shippingAddress: { ...record.shippingAddress },
        size: { ...record.size },
        materials: record.materials.map((m) => ({ ...m })),
        materialCost: record.finance.materialCost,
        otherFee: record.finance.otherFee,
        actualPrice: record.finance.actualPrice,
        remark: record.remark,
      },
      editingId: record.id,
      initialized: true,
    }),

  /** 从设置带出必选配件（默认数量 > 0 的连接件/紧固件） */
  reset: (settings) =>
    set({
      form: {
        ...structuredClone(EMPTY_FORM),
        size: { ...settings.defaultSize },
        materials: settings.defaultAccessories
          .filter((a) => a.defaultQuantity > 0)
          .map((a) => ({
            name: a.name,
            category: a.category as AccessoryItem['category'],
            quantity: a.defaultQuantity,
            unitPrice: a.defaultUnitPrice,
          })),
      },
      editingId: null,
      initialized: true,
    }),

  markLoading: () => set({ initialized: false }),

  setCustomer: (patch) =>
    set((s) => ({ form: { ...s.form, customer: { ...s.form.customer, ...patch } } })),

  setShippingAddress: (patch) =>
    set((s) => ({ form: { ...s.form, shippingAddress: { ...s.form.shippingAddress, ...patch } } })),

  setSize: (field, value) =>
    set((s) => ({ form: { ...s.form, size: { ...s.form.size, [field]: value } } })),

  setMaterialCost: (materialCost) => set((s) => ({ form: { ...s.form, materialCost } })),
  setOtherFee: (otherFee) => set((s) => ({ form: { ...s.form, otherFee } })),
  setActualPrice: (actualPrice) => set((s) => ({ form: { ...s.form, actualPrice } })),
  setRemark: (remark) => set((s) => ({ form: { ...s.form, remark } })),

  updateMaterial: (index, patch) =>
    set((s) => ({
      form: {
        ...s.form,
        materials: s.form.materials.map((m, i) => (i === index ? { ...m, ...patch } : m)),
      },
    })),

  addMaterial: (item) =>
    set((s) => ({ form: { ...s.form, materials: [...s.form.materials, item] } })),

  removeMaterial: (index) =>
    set((s) => ({
      form: { ...s.form, materials: s.form.materials.filter((_, i) => i !== index) },
    })),

  computeFinance: () => {
    const f = get().form;
    return calcOrderFinance(f.materialCost, f.otherFee, f.actualPrice);
  },
}));
