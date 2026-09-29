import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import App from './App.svelte';

describe('App 冒烟渲染', () => {
  it('渲染控台关键区域与 12 灯', () => {
    const { body } = render(App);
    expect(body).toContain('小剧场灯光走台控台');
    expect(body).toContain('GO');
    expect(body).toContain('黑场');
    expect(body).toContain('开场暖场');
    expect(body).toContain('落幕');
    expect(body).toContain('操作示例');
    expect((body.match(/舞台灯位示意/g) ?? []).length).toBe(1);
  });
});
