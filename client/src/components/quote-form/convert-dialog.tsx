/**
 * 报价转订单：跨页共用的确认弹窗与提交逻辑。
 * 使用方：报价列表行内转单、报价编辑器操作栏转单。
 * 编辑器场景下 dirty 表单的「先保存再转单」由调用方的 ensureSaved 保证——
 * start() 拿到的必须是已持久化的报价 id。
 */

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberField } from '@/components/number-field';
import { useToast } from '@/components/toaster';
import { emptyConvertForm, type ConvertConfirmForm } from '@/lib/convert-form';
import { quotesApi } from '@/lib/api';
import { calcQuote, type QuoteInput } from '@idle-fish/shared';

/** 参与转单的最小目标：已保存的报价 id + 当前输入快照 */
export interface ConvertTarget {
  id: string;
  input: QuoteInput;
}

export function useConvertQuote(onDone: (orderId: string, orderNo: string) => void) {
  const toast = useToast((s) => s.show);
  const [target, setTarget] = useState<ConvertTarget | null>(null);
  const [form, setForm] = useState<ConvertConfirmForm>(emptyConvertForm);
  const [converting, setConverting] = useState(false);

  /** 打开弹窗并按实时计价预填财务四项 */
  function start(t: ConvertTarget) {
    setTarget(t);
    const result = calcQuote(t.input);
    setForm({
      ...emptyConvertForm(),
      finance: {
        materialCost: result.breakdown.materialCost,
        installFee: result.breakdown.installFee,
        freight: result.breakdown.freight,
        actualPrice: result.finalPrice,
      },
    });
  }

  async function submit() {
    if (!target) return;
    if (!form.customer.name.trim()) {
      toast('请填写客户名称');
      return;
    }
    setConverting(true);
    try {
      const res = await quotesApi.convert(target.id, {
        customer: form.customer,
        shippingAddress: form.shippingAddress,
        remark: form.remark,
        finance: form.finance,
      });
      setTarget(null);
      onDone(res.orderId, res.orderNo);
    } catch (e) {
      toast(`转单失败：${e}`);
    } finally {
      setConverting(false);
    }
  }

  return { start, close, target, form, setForm, submit, converting };
}

interface ConvertQuoteDialogProps {
  target: ConvertTarget | null;
  form: ConvertConfirmForm;
  setForm: React.Dispatch<React.SetStateAction<ConvertConfirmForm>>;
  /** 外部仍在准备（如编辑器先保存中）时禁用提交 */
  preparing?: boolean;
  converting: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

const FINANCE_FIELDS: {
  key: 'materialCost' | 'installFee' | 'freight' | 'actualPrice';
  label: string;
}[] = [
  { key: 'materialCost', label: '材料成本' },
  { key: 'installFee', label: '安装费' },
  { key: 'freight', label: '运费' },
  { key: 'actualPrice', label: '实际售价' },
];

export function ConvertQuoteDialog({
  target,
  form,
  setForm,
  preparing,
  converting,
  onSubmit,
  onClose,
}: ConvertQuoteDialogProps) {
  const busy = converting || preparing;
  return (
    <Modal
      open={target !== null}
      onClose={() => !busy && onClose()}
      title="报价转订单"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          转单将自动保存当前报价。请逐项确认材料成本、安装费、运费与实际售价后创建订单。
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FINANCE_FIELDS.map((f) => (
            <NumberField
              key={f.key}
              label={f.label}
              value={form.finance[f.key]}
              onChange={(v) => setForm((prev) => ({ ...prev, finance: { ...prev.finance, [f.key]: v } }))}
              step={0.01}
              suffix="元"
            />
          ))}
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="convert-customer-name">客户名称 *</Label>
            <Input
              id="convert-customer-name"
              value={form.customer.name}
              onChange={(e) =>
                setForm((f0) => ({ ...f0, customer: { ...f0.customer, name: e.target.value } }))
              }
              placeholder="客户名称"
            />
          </div>
          <div className="space-y-1.5">
            <Label>平台订单号</Label>
            <Input
              value={form.customer.platformOrderNo}
              onChange={(e) =>
                setForm((f0) => ({ ...f0, customer: { ...f0.customer, platformOrderNo: e.target.value } }))
              }
              placeholder="如淘宝/京东订单号"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>收件人</Label>
              <Input
                value={form.shippingAddress.receiver}
                onChange={(e) =>
                  setForm((f0) => ({
                    ...f0,
                    shippingAddress: { ...f0.shippingAddress, receiver: e.target.value },
                  }))
                }
                placeholder="收件人姓名"
              />
            </div>
            <div className="space-y-1.5">
              <Label>电话</Label>
              <Input
                value={form.shippingAddress.phone}
                onChange={(e) =>
                  setForm((f0) => ({
                    ...f0,
                    shippingAddress: { ...f0.shippingAddress, phone: e.target.value },
                  }))
                }
                placeholder="手机号码"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>收货地址</Label>
            <Input
              value={form.shippingAddress.address}
              onChange={(e) =>
                setForm((f0) => ({
                  ...f0,
                  shippingAddress: { ...f0.shippingAddress, address: e.target.value },
                }))
              }
              placeholder="省市区详细地址"
            />
          </div>
          <div className="space-y-1.5">
            <Label>备注</Label>
            <Input
              value={form.remark}
              onChange={(e) => setForm((f0) => ({ ...f0, remark: e.target.value }))}
              placeholder="选填"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button variant="accent" onClick={onSubmit} disabled={busy}>
            {busy ? '转单中…' : '确认转单'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
