import { useEffect, useState } from 'react';
import { useApp } from '../store/app';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Die gewählte Darstellung, „System" aufgelöst – folgt einem Wechsel live. */
export function useResolvedTheme(): 'dark' | 'light' {
  const theme = useApp((state) => state.theme);
  const [systemDark, setSystemDark] = useState(() => theme === 'system' && darkQuery().matches);
  useEffect(() => {
    if (theme !== 'system') return;
    const media = darkQuery();
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [theme]);
  if (theme !== 'system') return theme;
  return systemDark ? 'dark' : 'light';
}
