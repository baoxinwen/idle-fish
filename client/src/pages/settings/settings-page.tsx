/**
 * 设置页：默认参数 + 配件配置 + 备份导入。
 */

import { useEffect, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NumberField } from '@/components/number-field';
import { ProfitRateField } from '@/components/profit-rate-field';
import { Select } from '@/components/ui/select';
import { useSettingsStore } from '@/store/settings-store';
import { useToast } from '@/components/toaster';
import { LoadingState } from '@/components/states';
import { confirmDialog } from '@/components/confirm-dialog';
import { AccessoriesConfig } from './accessories-config';
import { BackupSection } from './backup-section';
import { ChangePasswordSection } from './change-password-section';
import { COLOR_LABEL } from '@/lib/status';

export function SettingsPage() {
  const {
    settings,
    loaded,
    dirty,
    load,
    setDefaultSize,
    setDefaultColor,
    setDefaultTrayCount,
    setPricing,
    save,
  } = useSettingsStore();
  const toast = useToast((s) => s.show);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load().catch((e) => toast(`加载失败：${e}`));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true);
    try {
      await save();
      toast('设置已保存');
    } catch (e) {
      toast(`保存失败：${e}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleReload() {
    if (dirty && !(await confirmDialog({ message: '有未保存修改，确认放弃并重新加载？', confirmLabel: '放弃修改' }))) return;
    await load();
    toast('已重新加载');
  }

  if (!loaded || !settings) return <LoadingState />;

  const p = settings.defaultPricing;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="label-mono text-accent">SETTINGS · 设置</div>
          <h1 className="mt-1 text-xl font-bold tracking-tight lg:text-2xl">设置</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            默认机柜参数、计价参数、配件配置
          </p>
        </div>
        <div className="flex gap-2">
          {dirty && <span className="self-center text-xs text-amber-600 dark:text-amber-400">未保存</span>}
          <Button variant="outline" onClick={handleReload}>
            <RotateCcw className="h-4 w-4" />
            重载
          </Button>
          <Button variant="accent" onClick={handleSave} disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* 默认尺寸 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">默认机柜尺寸</CardTitle>
            <CardDescription>新建报价/订单时自动带入</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <NumberField label="宽" value={settings.defaultSize.width} onChange={(v) => setDefaultSize('width', v)} suffix="mm" />
            <NumberField label="深" value={settings.defaultSize.depth} onChange={(v) => setDefaultSize('depth', v)} suffix="mm" />
            <NumberField label="高" value={settings.defaultSize.height} onChange={(v) => setDefaultSize('height', v)} suffix="mm" />
          </CardContent>
        </Card>

        {/* 默认颜色与托盘 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">默认颜色与托盘</CardTitle>
            <CardDescription>新建报价时的初始值</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">默认颜色</label>
              <Select value={settings.defaultColor} onChange={(e) => setDefaultColor(e.target.value as 'silver' | 'black')}>
                {(['silver', 'black'] as const).map((c) => (
                  <option key={c} value={c}>{COLOR_LABEL[c]}</option>
                ))}
              </Select>
            </div>
            <NumberField label="默认托盘数" value={settings.defaultTrayCount} onChange={(v) => setDefaultTrayCount(v)} step={1} />
          </CardContent>
        </Card>

        {/* 计价参数 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">默认计价参数</CardTitle>
            <CardDescription>单次报价可在报价页覆盖这些值</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 型材相关 */}
            <div>
              <div className="label-mono mb-2 text-[10px] text-muted-foreground/70">型材</div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <NumberField label="银色型材单价" value={p.silverPrice} onChange={(v) => setPricing({ silverPrice: v })} step={0.01} suffix="元/m" />
                <NumberField label="黑色型材单价" value={p.blackPrice} onChange={(v) => setPricing({ blackPrice: v })} step={0.01} suffix="元/m" />
                <NumberField label="损耗率" value={p.wastage} onChange={(v) => setPricing({ wastage: v })} step={0.01} emptyValue={1} />
                <ProfitRateField label="默认毛利率" value={p.profitRate} onChange={(v) => setPricing({ profitRate: v })} />
              </div>
            </div>
            {/* 费用相关 */}
            <div>
              <div className="label-mono mb-2 text-[10px] text-muted-foreground/70">费用</div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <NumberField label="切割处理费" value={p.cuttingFee} onChange={(v) => setPricing({ cuttingFee: v })} step={0.01} suffix="元" />
                <NumberField label="安装费" value={p.installFee} onChange={(v) => setPricing({ installFee: v })} step={0.01} suffix="元" />
                <NumberField label="运费" value={p.freight} onChange={(v) => setPricing({ freight: v })} step={0.01} suffix="元" />
              </div>
            </div>
            {/* 托盘系数 */}
            <div>
              <div className="label-mono mb-2 text-[10px] text-muted-foreground/70">托盘</div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <NumberField label="托盘系数 A" value={p.trayCoeffA} onChange={(v) => setPricing({ trayCoeffA: v })} step={0.01} />
                <NumberField label="托盘系数 B" value={p.trayCoeffB} onChange={(v) => setPricing({ trayCoeffB: v })} step={0.01} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 配件配置（跨列） */}
        <div className="lg:col-span-2">
          <AccessoriesConfig />
        </div>

        {/* 修改密码（跨列） */}
        <div className="lg:col-span-2">
          <ChangePasswordSection />
        </div>

        {/* 备份导入（跨列） */}
        <div className="lg:col-span-2">
          <BackupSection />
        </div>
      </div>
    </div>
  );
}
