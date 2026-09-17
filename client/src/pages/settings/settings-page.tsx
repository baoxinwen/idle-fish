/**
 * 设置页：品牌信息 + 默认参数 + 配件配置 + 账户安全 + 备份导入。
 * v2：新增「品牌信息」（导出单抬头卖家名）；尺寸与颜色合并为「默认机柜」卡；
 *     颜色用 SegmentedControl 替换原生 select。
 */

import { useEffect, useState } from 'react';
import { Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberField } from '@/components/number-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ParamRow } from '@/components/param-row';
import { useSettingsStore } from '@/store/settings-store';
import { useToast } from '@/components/toaster';
import { LoadingState, EmptyState } from '@/components/states';
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
    setPricing,
    setBrand,
    save,
  } = useSettingsStore();
  const toast = useToast((s) => s.show);
  const [saving, setSaving] = useState(false);
  // I-5：加载失败的终止态——此前失败只 toast，页面永久停留「加载中」且无重试
  const [loadError, setLoadError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    setLoadError(false);
    load().catch((e) => {
      setLoadError(true);
      toast(`加载失败：${e}`);
    });
  }, [retryNonce]); // 仅首次挂载与手动重试时加载

  async function handleSave() {
    setSaving(true);
    try {
      await save();
      toast('设置已保存');
    } catch (e) {
      toast(`设置保存失败：${e}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleReload() {
    if (dirty && !(await confirmDialog({ message: '有未保存修改，确认放弃并重新加载？', confirmLabel: '放弃修改' }))) return;
    // F-05：此前裸 await load()——失败时无提示、控制台 unhandledrejection
    try {
      await load();
      toast('已重新加载');
    } catch (e) {
      toast(`加载失败：${e}`);
    }
  }

  if (loadError && (!loaded || !settings)) {
    return (
      <EmptyState
        icon={AlertTriangle}
        text="加载失败"
        hint="设置数据未能加载，请检查网络后重试"
        actionLabel="重试"
        onAction={() => setRetryNonce((n) => n + 1)}
        className="mt-10"
      />
    );
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
            品牌信息、默认机柜参数、计价参数、配件配置
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

      {/* 品牌：导出单抬头 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">品牌信息</CardTitle>
          <CardDescription>显示在客户报价图 / 生产制作单的抬头（如「卖家 @店名」）</CardDescription>
        </CardHeader>
        <CardContent className="max-w-md">
          <div className="space-y-1.5">
            <Label>卖家名称</Label>
            <Input
              value={settings.brand.sellerName}
              onChange={(e) => setBrand({ sellerName: e.target.value })}
              placeholder="如 @某某铝业"
              maxLength={50}
            />
          </div>
        </CardContent>
      </Card>

      {/* 默认机柜：尺寸 + 颜色合并一卡，视觉平衡且少一次扫视跳转 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">默认机柜</CardTitle>
          <CardDescription>新建报价/订单时自动带入</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="宽" value={settings.defaultSize.width} onChange={(v) => setDefaultSize('width', v)} suffix="mm" />
            <NumberField label="深" value={settings.defaultSize.depth} onChange={(v) => setDefaultSize('depth', v)} suffix="mm" />
            <NumberField label="高" value={settings.defaultSize.height} onChange={(v) => setDefaultSize('height', v)} suffix="mm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">默认颜色</Label>
            <SegmentedControl
              ariaLabel="默认颜色"
              value={settings.defaultColor}
              onChange={setDefaultColor}
              options={[
                { value: 'silver', label: COLOR_LABEL.silver, dot: '#E4E4E7' },
                { value: 'black', label: COLOR_LABEL.black, dot: '#3F3F46' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* 计价参数 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="label-mono text-xs font-semibold text-muted-foreground">默认计价参数</CardTitle>
          <CardDescription>单次报价可在报价页覆盖这些值</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 表格形式：标签固定宽 + 输入框等宽对齐 + 单位固定宽 */}
          <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-2">
            {/* 型材 */}
            <div>
              <div className="label-mono mb-1 border-b border-border pb-1 text-[10px] text-muted-foreground/70">型材</div>
              <ParamRow label="银色型材单价" unit="元/m" value={p.silverPrice} onChange={(v) => setPricing({ silverPrice: v })} displayDecimals={2} />
              <ParamRow label="黑色型材单价" unit="元/m" value={p.blackPrice} onChange={(v) => setPricing({ blackPrice: v })} displayDecimals={2} />
              <ParamRow label="损耗率" unit="%" value={p.wastage} onChange={(v) => setPricing({ wastage: v })} wastage />
              <ParamRow label="默认毛利率" unit="%" value={p.profitRate} onChange={(v) => setPricing({ profitRate: v })} percent />
            </div>
            {/* 费用 + 托盘 */}
            <div>
              <div className="label-mono mb-1 border-b border-border pb-1 text-[10px] text-muted-foreground/70">费用</div>
              <ParamRow label="切割处理费" unit="元" value={p.cuttingFee} onChange={(v) => setPricing({ cuttingFee: v })} displayDecimals={2} />
              <ParamRow label="安装费" unit="元" value={p.installFee} onChange={(v) => setPricing({ installFee: v })} displayDecimals={2} />
              <ParamRow label="运费" unit="元" value={p.freight} onChange={(v) => setPricing({ freight: v })} displayDecimals={2} />
              <div className="label-mono mb-1 mt-3 border-b border-border pb-1 text-[10px] text-muted-foreground/70">托盘</div>
              <ParamRow label="托盘系数 A" unit="" value={p.trayCoeffA} onChange={(v) => setPricing({ trayCoeffA: v })} unclamped />
              <ParamRow label="托盘系数 B" unit="" value={p.trayCoeffB} onChange={(v) => setPricing({ trayCoeffB: v })} unclamped />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 配件配置 */}
      <AccessoriesConfig />

      {/* 修改密码 */}
      <ChangePasswordSection />

      {/* 备份导入 */}
      <BackupSection />
    </div>
  );
}
