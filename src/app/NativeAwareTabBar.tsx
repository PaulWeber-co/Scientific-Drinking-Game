import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from '../lib/platform';
import { TabBar } from './TabBar';

const paths = ['/', '/lobby', '/pegel', '/album'] as const;
type NativeTabs = {
  show: (options: { selected: number }) => Promise<void>;
  setSelected: (options: { selected: number }) => Promise<void>;
  hide: () => Promise<void>;
  addListener: (
    event: 'tabSelected',
    callback: (event: { index: number }) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
};

function selectedTab(path: string): number {
  if (path.startsWith('/lobby')) return 1;
  if (path.startsWith('/pegel')) return 2;
  if (path.startsWith('/album')) return 3;
  return 0;
}

/**
 * Nur ein registriertes iOS-Plugin darf die Web-Leiste ersetzen. Ohne das
 * Plugin (Browser, Android, aelterer TestFlight-Build) bleibt sie sichtbar.
 */
export function NativeAwareTabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [native, setNative] = useState(false);
  const [plugin, setPlugin] = useState<NativeTabs | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    let active = true;
    let tabs: NativeTabs | null = null;
    let listener: { remove: () => Promise<void> } | null = null;
    void (async () => {
      const { Capacitor, registerPlugin } = await import('@capacitor/core');
      if (Capacitor.getPlatform() !== 'ios' || !Capacitor.isPluginAvailable('NativeTabs')) return;
      tabs = registerPlugin<NativeTabs>('NativeTabs');
      listener = await tabs.addListener('tabSelected', ({ index }) => {
        if (Number.isInteger(index) && index >= 0 && index < paths.length) navigate(paths[index]);
      });
      if (!active) {
        await listener.remove();
        return;
      }
      await tabs.show({ selected: selectedTab(pathRef.current) });
      if (!active) {
        await tabs.hide();
        return;
      }
      setPlugin(tabs);
      setNative(true);
    })().catch(() => {
      // Fehlende oder inkompatible native Implementierung: Web-Leiste bleibt.
    });
    return () => {
      active = false;
      void listener?.remove();
      void tabs?.hide();
    };
  }, [navigate]);

  useEffect(() => {
    if (plugin) void plugin.setSelected({ selected: selectedTab(pathname) }).catch(() => {
      void plugin.hide();
      setNative(false);
    });
  }, [plugin, pathname]);

  return native ? <span className="native-tabbar-anchor" aria-hidden="true" /> : <TabBar />;
}
