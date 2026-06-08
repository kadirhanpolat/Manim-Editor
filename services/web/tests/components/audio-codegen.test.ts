import { describe, it, expect } from 'vitest';
import { generateManimScript } from '../../src/export/manim.js';

const SW = 1920,
  SH = 1080;

function makeObj(id) {
  return {
    id,
    type: 'circle',
    x: SW / 2,
    y: SH / 2,
    width: 200,
    height: 200,
    fill: '#ffffff',
    stroke: 'transparent',
    strokeWidth: 2,
    opacity: 1,
    rotation: 0,
    enterTime: 0,
    duration: 5,
    enterAnim: 'none',
    exitAnim: 'none',
  };
}

function makeProject(clips) {
  return {
    name: 'AudioTest',
    stage: { width: SW, height: SH, backgroundColor: '#000000' },
    objects: [makeObj('obj1')],
    groups: [],
    tracks: [{ id: 'track_1', name: 'Track 1', clips }],
  };
}

const readyAudio = (type = 'gtts') => ({
  type,
  src: '/data/assets/audio/abc123.wav',
  syncMode: 'auto',
  status: 'ready',
  duration: 2.5,
});

describe('VoiceoverScene base class', () => {
  it('uses Scene when no clips have audio', () => {
    const script = generateManimScript(makeProject([]));
    expect(script).toContain('class MainScene(Scene)');
    expect(script).not.toContain('VoiceoverScene');
  });

  it('uses VoiceoverScene when clip has ready audio', () => {
    const clips = [
      {
        id: 'c1',
        type: 'move',
        startTime: 1,
        duration: 2,
        sourceId: 'obj1',
        params: { targetX: SW / 2, targetY: SH / 2 },
        easing: 'linear',
        parallel: false,
        lag_ratio: 0,
        audio: readyAudio(),
      },
    ];
    const script = generateManimScript(makeProject(clips));
    expect(script).toContain('VoiceoverScene');
  });

  it('does NOT use VoiceoverScene for pending audio', () => {
    const clips = [
      {
        id: 'c1',
        type: 'move',
        startTime: 1,
        duration: 2,
        sourceId: 'obj1',
        params: { targetX: SW / 2, targetY: SH / 2 },
        easing: 'linear',
        parallel: false,
        lag_ratio: 0,
        audio: { type: 'gtts', status: 'pending' },
      },
    ];
    const script = generateManimScript(makeProject(clips));
    expect(script).not.toContain('VoiceoverScene');
  });
});

describe('voiceover wrapping', () => {
  it('wraps move clip animation in with self.voiceover()', () => {
    const clips = [
      {
        id: 'c1',
        type: 'move',
        startTime: 1,
        duration: 2,
        sourceId: 'obj1',
        params: { targetX: SW / 2, targetY: SH / 2 },
        easing: 'linear',
        parallel: false,
        lag_ratio: 0,
        audio: readyAudio(),
      },
    ];
    const script = generateManimScript(makeProject(clips));
    expect(script).toContain('with self.voiceover(audio=');
    expect(script).toContain('/data/assets/audio/abc123.wav');
    expect(script).toContain('self.play(');
  });

  it('auto syncMode appends self.wait for remaining audio duration', () => {
    const clips = [
      {
        id: 'c1',
        type: 'move',
        startTime: 0,
        duration: 2,
        sourceId: 'obj1',
        params: { targetX: SW / 2, targetY: SH / 2 },
        easing: 'linear',
        parallel: false,
        lag_ratio: 0,
        audio: readyAudio(),
      },
    ];
    const script = generateManimScript(makeProject(clips));
    expect(script).toContain('.duration - ');
  });

  it('manual syncMode with offset prepends self.wait(offset)', () => {
    const clips = [
      {
        id: 'c1',
        type: 'move',
        startTime: 0,
        duration: 2,
        sourceId: 'obj1',
        params: { targetX: SW / 2, targetY: SH / 2 },
        easing: 'linear',
        parallel: false,
        lag_ratio: 0,
        audio: {
          type: 'file',
          src: '/data/assets/audio/abc123.wav',
          syncMode: 'manual',
          offset: 0.5,
          status: 'ready',
          duration: 3.0,
        },
      },
    ];
    const script = generateManimScript(makeProject(clips));
    expect(script).toContain('self.wait(0.5)');
    expect(script).not.toContain('tracker.duration');
  });

  it('clip without audio is not wrapped', () => {
    const clips = [
      {
        id: 'c1',
        type: 'move',
        startTime: 0,
        duration: 2,
        sourceId: 'obj1',
        params: { targetX: SW / 2, targetY: SH / 2 },
        easing: 'linear',
        parallel: false,
        lag_ratio: 0,
      },
    ];
    const script = generateManimScript(makeProject(clips));
    expect(script).not.toContain('with self.voiceover');
  });
});
