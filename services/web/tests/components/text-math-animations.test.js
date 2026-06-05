import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProjectStore, ENTER_ANIMS, EXIT_ANIMS } from '../../src/store/project.js';
import { generateManimScript, parseManimScript } from '../../src/export/manim.js';

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useProjectStore();
  store.newProject('Test', 'visual');
  store.commitState();
});

describe('typewriter presets', () => {
  it('registers typewriter enter + exit presets', () => {
    expect(ENTER_ANIMS.find(a => a.value === 'typewriter')).toBeTruthy();
    expect(EXIT_ANIMS.find(a => a.value === 'typewriter_out')).toBeTruthy();
  });

  it('emits AddTextLetterByLetter / RemoveTextLetterByLetter', () => {
    const obj = store.addObject('text', 960, 540);
    obj.content = 'Hello';
    obj.enterAnim = 'typewriter';
    obj.exitAnim = 'typewriter_out';
    obj.enterTime = 0; obj.duration = 4;
    const py = generateManimScript(store.project);
    expect(py).toContain('AddTextLetterByLetter');
    expect(py).toContain('RemoveTextLetterByLetter');
  });

  it('round-trips typewriter enter through parse', () => {
    const obj = store.addObject('text', 960, 540);
    obj.content = 'Hi'; obj.enterAnim = 'typewriter'; obj.enterTime = 0; obj.duration = 3;
    const py = generateManimScript(store.project);
    const parsed = parseManimScript(py);
    const reObj = parsed.objects.find(o => o.type === 'text');
    expect(reObj.enterAnim).toBe('typewriter');
  });

  it('round-trips typewriter_out exit through parse', () => {
    const obj = store.addObject('text', 960, 540);
    obj.content = 'Bye'; obj.exitAnim = 'typewriter_out'; obj.enterTime = 0; obj.duration = 3;
    const py = generateManimScript(store.project);
    const parsed = parseManimScript(py);
    const reObj = parsed.objects.find(o => o.type === 'text');
    expect(reObj.exitAnim).toBe('typewriter_out');
  });
});

describe('font round-trip', () => {
  it('preserves fontFamily through generate/parse', () => {
    const obj = store.addObject('text', 960, 540);
    obj.content = 'Hello'; obj.fontFamily = 'Courier New'; obj.enterTime = 0; obj.duration = 3;
    const py = generateManimScript(store.project);
    const parsed = parseManimScript(py);
    const reObj = parsed.objects.find(o => o.type === 'text');
    expect(reObj.fontFamily).toBe('Courier New');
  });
});
