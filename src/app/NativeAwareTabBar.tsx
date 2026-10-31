import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isNativeApp } from '../lib/platform';
import { motionReduced } from '../lib/motion';
import { useApp } from '../store/app';
import { TabBar } from './TabBar';

const paths = ['/', '/lobby', '/pegel', '/album'] as const;
type NativeTabs = {
  show: (options: { selected: number; theme: 'dark' | 'light' }) => Promise<void>;
  hide: () => Promise<void>;
  addListener: (
    event: 'tabSelected',
    callback: (event: { index: number }) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
};

// Eine alte Sitzung darf ihre Leiste nicht erst nach dem show() ihrer
// Nachfolgerin verstecken (StrictMode, schneller Wechsel Spiel <-> Lobby).
let commands: Promise<unknown> = Promise.resolve();
let runtime: Promise<typeof import('@capacitor/core')> | null = null;
function enqueue(command: () => Promise<void>): Promise<void> {
  const result = commands.then(command);
  commands = result.catch(() => {});
  return result;
}

function selectedTab(path: string): number {
  if (path.startsWith('/lobby')) return 1;
  if (path.startsWith('/pegel')) return 2;
  if (path.startsWith('/album')) return 3;
  return 0;
}

const covered = () => document.hidden || !!document.querySelector('[role="dialog"][aria-modal="true"]');

/** Web-Fallback, bis ein registriertes iOS-Plugin die Leiste uebernimmt. */
export function NativeAwareTabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const theme = useApp((s) => s.theme);
  const current = useRef({ pathname, navigate, theme });
  current.current = { pathname, navigate, theme };
  const requestSync = useRef<(() => void) | null>(null);
  const [native, setNative] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    let active = true;
    let failed = false;
    let tabs: NativeTabs | null = null;
    let listener: { remove: () => Promise<void> } | null = null;
    let observer: MutationObserver | null = null;
    let signature = '';

    const releaseListener = () => {
      const previous = listener;
      listener = null;
      void previous?.remove().catch(() => {});
    };
    const fail = () => {
      if (!active || failed) return;
      failed = true;
      releaseListener();
      observer?.disconnect();
      if (tabs) void enqueue(() => tabs!.hide()).catch(() => {});
      setNative(false);
    };
    const sync = () => {
      if (!active || failed || !tabs) return;
      const { pathname, theme } = current.current;
      const hidden = covered();
      const next = `${selectedTab(pathname)}|${theme}|${hidden}`;
      if (next === signature) return;
      signature = next;
      void enqueue(async () => {
        if (!active || failed) return;
        if (hidden) await tabs!.hide();
        else await tabs!.show({ selected: selectedTab(pathname), theme });
        if (active && !failed) setNative(true);
      }).catch(fail);
    };

    requestSync.current = sync;
    void (async () => {
      const { Capacitor, registerPlugin } = await (runtime ??= import('@capacitor/core'));
      if (!active || Capacitor.getPlatform() !== 'ios' || !Capacitor.isPluginAvailable('NativeTabs')) return;
      tabs = registerPlugin<NativeTabs>('NativeTabs');
      listener = await tabs.addListener('tabSelected', ({ index }) => {
        if (!active || failed || covered() || !Number.isInteger(index) || index < 0 || index >= paths.length) return;
        const { pathname, navigate } = current.current;
        if (pathname === paths[index]) window.scrollTo({ top: 0, behavior: motionReduced() ? 'auto' : 'smooth' });
        else navigate(paths[index]);
      });
      if (!active) {
        releaseListener();
        return;
      }
      // UIKit liegt ueber dem ganzen WebView. CSS-z-index kann die native
      // Leiste deshalb nicht unter Sheets/Einladungen verschieben.
      observer = new MutationObserver(sync);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'aria-modal'] });
      document.addEventListener('visibilitychange', sync);
      sync();
    })().catch(fail);

    return () => {
      active = false;
      requestSync.current = null;
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      releaseListener();
      if (tabs) void enqueue(() => tabs!.hide()).catch(() => {});
    };
  }, []);

  useEffect(() => { requestSync.current?.(); }, [pathname, theme]);
  return native ? <span className="native-tabbar-anchor" aria-hidden="true" /> : <TabBar />;
}
