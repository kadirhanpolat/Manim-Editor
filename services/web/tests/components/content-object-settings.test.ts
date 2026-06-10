import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useProjectStore } from '../../src/store/project.js';
import { settingsComponentFor } from '../../src/components/inspector/object-settings/index.js';
import CodeSettings from '../../src/components/inspector/object-settings/CodeSettings.vue';
import BarChartSettings from '../../src/components/inspector/object-settings/BarChartSettings.vue';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('CodeSettings', () => {
  it('is registered for type "code"', () => {
    expect(settingsComponentFor('code')).toBe(CodeSettings);
  });

  it('edits codeText, language (allowlist dropdown) and fontSize on the object', async () => {
    const obj = store.addObject('code', 960, 540);
    const w = mount(CodeSettings, { props: { obj } });
    await w.find('[data-test="code-text"]').setValue('x = 1\ny = 2');
    expect(obj.codeText).toBe('x = 1\ny = 2');
    const select = w.find('[data-test="code-language"]');
    expect(select.findAll('option').map((o) => o.element.value)).toContain('cpp');
    await select.setValue('cpp');
    expect(obj.language).toBe('cpp');
    await w.find('[data-test="code-fontsize"]').setValue('24');
    expect(obj.fontSize).toBe(24);
  });
});

describe('BarChartSettings', () => {
  it('is registered for type "bar_chart"', () => {
    expect(settingsComponentFor('bar_chart')).toBe(BarChartSettings);
  });

  it('edits values/names/colors/yMax and adds/removes bars (min 1 bar guard)', async () => {
    const obj = store.addObject('bar_chart', 960, 540);
    const w = mount(BarChartSettings, { props: { obj } });
    await w.findAll('[data-test="bar-value"]')[0].setValue('7');
    expect(obj.values[0]).toBe(7);
    await w.findAll('[data-test="bar-name"]')[1].setValue('Q2');
    expect(obj.barNames[1]).toBe('Q2');
    await w.find('[data-test="bar-ymax"]').setValue('10');
    expect(obj.yMax).toBe(10);
    await w.find('[data-test="bar-add"]').trigger('click');
    expect(obj.values.length).toBe(5);
    expect(obj.barNames.length).toBe(5);
    expect(obj.barColors.length).toBe(5);
    await w.find('[data-test="bar-remove"]').trigger('click');
    expect(obj.values.length).toBe(4);
  });
});
