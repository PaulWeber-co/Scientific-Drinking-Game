import { afterEach, describe, expect, it, vi } from 'vitest';
import { resumeSound, setAudioFactory, setSoundEnabled, sound, stopSounds } from './sound';

/**
 * jsdom hat kein Web-Audio. Ohne einhängbare Kontext-Fabrik liesse sich an
 * dieser Schicht gar nichts prüfen – und ein Test, der nichts prüfen kann,
 * ist keiner.
 */
function param() {
  return { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
}

function fakeContext(state: 'running' | 'suspended' = 'running') {
  const gains: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    gain: ReturnType<typeof param>;
  }[] = [];
  const sources: {
    start: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    playbackRate: ReturnType<typeof param>;
    onended: (() => void) | null;
  }[] = [];
  const filters: {
    type: string;
    connect: ReturnType<typeof vi.fn>;
    frequency: ReturnType<typeof param>;
  }[] = [];
  const ctx = {
    state,
    currentTime: 0,
    sampleRate: 44100,
    destination: { id: 'ziel' },
    resume: vi.fn(() => {
      ctx.state = 'running';
      return Promise.resolve();
    }),
    createGain: () => {
      const g = { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(g);
      return g;
    },
    createDynamicsCompressor: () => ({
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      connect: vi.fn(),
    }),
    createBufferSource: () => {
      const s = {
        buffer: null as unknown,
        playbackRate: param(),
        connect: vi.fn(),
        start: vi.fn(),
        onended: null as (() => void) | null,
      };
      sources.push(s);
      return s;
    },
    createOscillator: () => ({
      type: '',
      frequency: param(),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    }),
    createBiquadFilter: () => {
      const f = { type: '', frequency: param(), connect: vi.fn() };
      filters.push(f);
      return f;
    },
    createBuffer: (_channels: number, frames: number) => ({
      duration: frames / 44100,
      getChannelData: () => new Float32Array(frames),
    }),
  };
  setAudioFactory(() => ctx as unknown as AudioContext);
  return { ctx, gains, sources, filters };
}

afterEach(() => {
  setAudioFactory(null);
  setSoundEnabled(true);
});

describe('Klänge', () => {
  it('verdrahtet Quelle, Filter und Hüllkurve bis zum Sammelpunkt', () => {
    // Ohne diese Pruefung bliebe alles gruen, wenn der letzte `connect`
    // fehlte - und dann waere schlicht nichts zu hoeren.
    const { gains, sources, filters } = fakeContext();
    sound('tick');
    expect(sources).toHaveLength(1);
    expect(sources[0].connect).toHaveBeenCalledWith(filters[0]);
    // gains[0] ist der Sammelpunkt, gains[1] die Huellkurve dieses Klangs.
    expect(filters[0].connect).toHaveBeenCalledWith(gains[1]);
    expect(gains[1].connect).toHaveBeenCalledWith(gains[0]);
    expect(sources[0].start).toHaveBeenCalled();
  });

  it('gibt dem Tick einen Hochpass weit oben', () => {
    // Bei 2 kHz kam ein dumpfes „Tuff" heraus statt eines Ticks.
    const { filters } = fakeContext();
    sound('tick');
    expect(filters[0].type).toBe('highpass');
    const gesetzt = filters[0].frequency.value;
    expect(gesetzt).toBeGreaterThan(4000);
    expect(gesetzt).toBeLessThan(7000);
  });

  it('lässt den Knall den Filter nach unten fahren', () => {
    // Ein FESTER Filter ueber Rauschen klingt nach Rauschen, das leiser wird.
    const { filters } = fakeContext();
    sound('boom');
    expect(filters[0].type).toBe('lowpass');
    expect(filters[0].frequency.setValueAtTime).toHaveBeenCalled();
    expect(filters[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalled();
  });

  it('streut den Tick, damit er nicht als Muster auffällt', () => {
    const { filters, sources } = fakeContext();
    sound('tick');
    sound('tick');
    expect(filters[0].frequency.value).not.toBe(filters[1].frequency.value);
    expect(sources[0].playbackRate.value).not.toBe(sources[1].playbackRate.value);
  });

  it('räumt die Knoten auf, wenn ein Klang zu Ende ist', () => {
    // Der Zuender feuert ueber eine Minute rund 375 Mal.
    const { gains, sources } = fakeContext();
    sound('tick');
    sources[0].onended?.();
    expect(gains[1].disconnect).toHaveBeenCalled();
  });

  it('schweigt, wenn der Schalter aus ist', () => {
    const { sources } = fakeContext();
    setSoundEnabled(false);
    sound('boom');
    expect(sources).toHaveLength(0);
  });

  it('spielt wieder, sobald der Schalter zurück auf an geht', () => {
    // Gegenprobe: `setSoundEnabled(false)` haengt den Sammelpunkt ab. Kaeme
    // er nicht zurueck, waere der Schalter eine Einbahnstrasse.
    const { sources } = fakeContext();
    setSoundEnabled(false);
    sound('tick');
    setSoundEnabled(true);
    sound('tick');
    expect(sources).toHaveLength(1);
  });

  it('spielt nichts, solange der Kontext angehalten ist', () => {
    const { sources } = fakeContext('suspended');
    sound('tick');
    expect(sources).toHaveLength(0);
  });

  it('weckt einen angehaltenen Kontext auf', () => {
    const { ctx, sources } = fakeContext('suspended');
    resumeSound();
    expect(ctx.resume).toHaveBeenCalled();
    sound('tick');
    expect(sources).toHaveLength(1);
  });

  it('hängt beim Abbrechen den Sammelpunkt ab und baut ihn danach neu', () => {
    const { gains } = fakeContext();
    sound('boom');
    stopSounds();
    expect(gains[0].disconnect).toHaveBeenCalled();
    sound('tick');
    expect(gains.length).toBeGreaterThan(3);
  });

  it('verkraftet eine Umgebung ganz ohne Web-Audio', () => {
    setAudioFactory(() => null);
    expect(() => sound('boom')).not.toThrow();
    expect(() => resumeSound()).not.toThrow();
  });

  it('verkraftet einen Kontext, der beim Bauen wirft', () => {
    // Safari wirft, wenn das Kontingent erschoepft ist. Ohne Fang reisst
    // der Wurf die Timeout-Kette des Zuenders ab.
    setAudioFactory(() => {
      throw new Error('zu viele Kontexte');
    });
    expect(() => sound('tick')).not.toThrow();
  });
});
