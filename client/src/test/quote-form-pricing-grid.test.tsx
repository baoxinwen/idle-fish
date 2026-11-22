/**
 * 「计价参数」布局回归测试。
 *
 * 背景：jsdom 无布局引擎，量不了真实宽度，这里锁定引发 bug 的结构性契约。
 * 该栅格位于报价页左列（lg 起页面为 1fr/1.1fr 双栏，左列只占约一半宽度）。
 * 若它再用视口断点（lg:grid-cols-2）强切两列，ParamRow 的固定开销
 * （标签 112px + 单位 40px + 两个 gap 共 24px = 176px）会超过半宽列的列宽，
 * 唯一可收缩的数字输入框（flex-1，min-width:auto 经 w-full 输入框解析后
 * 只剩内边距）被压成 ~27px 竖条——实测 1024–1366px 视口输入框不可见。
 *
 * 契约一：计价参数栅格任何视口宽度下都不得切两列。
 * 契约二：ParamRow 输入框容器必须带最小宽度兜底，挤压时宁可轻微溢出也不可隐形。
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuoteForm } from '@/components/quote-form/quote-form';

async function renderExpandedPricing() {
  render(
    <MemoryRouter>
      <QuoteForm settings={null} />
    </MemoryRouter>,
  );
  screen.getByRole('button', { name: /计价参数/ }).click();
  // 展开后型材分区头可见（点击后状态异步 flush）
  await screen.findByText('型材');
}

describe('计价参数布局回归（输入框在特定视口被压成竖条）', () => {
  it('计价参数栅格不按视口断点切两列', async () => {
    await renderExpandedPricing();
    // 型材分区头 → 列容器 → 栅格容器（CardContent）
    const grid = screen.getByText('型材').parentElement!.parentElement!;
    expect(grid.className).not.toMatch(/grid-cols-2/);
    expect(grid.className).toContain('grid-cols-1');
  });

  it('ParamRow 输入框容器带最小宽度兜底', async () => {
    await renderExpandedPricing();
    // 银色单价行 → 行内的数字输入框 → flex 包装层 → 外层容器（flex-1 那层）
    const row = screen.getByText('银色单价').parentElement!;
    const wrapper = row.querySelector('input')!.parentElement!.parentElement!;
    expect(wrapper.className).toMatch(/min-w-\d+/);
  });
});

describe('配件清单布局契约（名称列被压成 0px 回归）', () => {
  it('配件清单卡是容器查询容器，表头与配件行同由容器宽度驱动', async () => {
    render(
      <MemoryRouter>
        <QuoteForm settings={null} />
      </MemoryRouter>,
    );
    // 配件清单 CardContent 必须声明 container-type，否则行上的 @container 变体永不命中
    const cardContent = screen.getByText('配件清单').closest('div[class*="rounded-lg"]')!.querySelector('div[class*="container-type"]');
    expect(cardContent).toBeTruthy();
    // 五列表头不按视口断点启用
    const header = cardContent!.querySelector('div[class*="grid-cols-"][class*="hidden"]');
    expect(header!.className).toContain('[@container(min-width:430px)]:grid');
    expect(header!.className).not.toMatch(/sm:grid/);
  });
});
