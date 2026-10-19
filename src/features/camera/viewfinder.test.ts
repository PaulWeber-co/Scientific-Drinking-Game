import { afterEach, describe, expect, it, vi } from 'vitest';
import { weitwinkelSuchen } from './useViewfinder';

const track = (caps: object) => ({ getCapabilities: () => caps }) as unknown as MediaStreamTrack;
const geräte = (labels: string[]) =>
  vi.stubGlobal('navigator', {
    mediaDevices: {
      enumerateDevices: async () =>
        labels.map((label, i) => ({ kind: 'videoinput', label, deviceId: `d${i}` })),
    },
  });

describe('Weitwinkel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('zoomt die Rückkamera, wenn sie unter 1 kann', async () => {
    geräte(['Back Ultra Wide Camera']);
    expect(await weitwinkelSuchen(track({ zoom: { min: 0.5, max: 10 } }))).toEqual({ zoom: 0.5 });
  });

  it('nimmt sonst die Ultraweitwinkel-Linse aus der Liste', async () => {
    geräte(['Rückseitige Kamera', 'Rückseitige Ultraweitwinkelkamera']);
    expect(await weitwinkelSuchen(track({ zoom: { min: 1 } }))).toEqual({ deviceId: 'd1' });
  });

  it('bietet nichts an, wenn das Gerät keins von beidem hat', async () => {
    geräte(['Back Camera', 'Front Camera']);
    expect(await weitwinkelSuchen(track({}))).toBeNull();
  });
});
