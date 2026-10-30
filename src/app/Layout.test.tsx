import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from './Layout';

vi.mock('../features/bac/WaterReminder', () => ({ WaterReminder: () => null }));
vi.mock('../features/party/GameInvite', () => ({ GameInvite: () => null }));
vi.mock('../lib/haptics', () => ({ haptic: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

it.each(['/', '/spiele/kings-cup'])('markiert Spiele auf %s', (path) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Layout />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'Spiele' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Runde' })).not.toHaveAttribute('aria-current');
});

it.each(['/lobby', '/pegel', '/album'])('markiert auf %s nur den passenden Tab', (path) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Layout />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'Spiele' })).not.toHaveAttribute('aria-current');
  expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
});

it('wechselt per Tipp oder Tastatur den Tab und lässt die Linse folgen', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Layout />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'Pegel' }));
  expect(screen.getByRole('link', { name: 'Pegel' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Pegel' })).toHaveClass('is-lit');
  expect(screen.getByRole('link', { name: 'Spiele' })).not.toHaveClass('is-lit');
});

it('lässt auf dem Profil die Linse bei den Spielen, ohne sie als aktuelle Seite auszugeben', () => {
  render(
    <MemoryRouter initialEntries={['/profil']}>
      <Layout />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'Spiele' })).toHaveClass('is-lit');
  expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
});

it('scrollt beim erneuten Tipp auf den aktiven Tab nach oben, statt neu zu laden', () => {
  render(
    <MemoryRouter initialEntries={['/pegel']}>
      <Layout />
    </MemoryRouter>,
  );
  vi.mocked(window.scrollTo).mockClear();
  fireEvent.click(screen.getByRole('link', { name: 'Pegel' }));
  expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
});

it('lässt die Leiste nach einem verlorenen Finger wieder bedienbar', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Layout />
    </MemoryRouter>,
  );
  const bar = document.querySelector('.tabbar__inner')!;
  fireEvent.pointerDown(bar, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
  expect(bar).toHaveClass('is-pressed');
  fireEvent(bar, Object.assign(new Event('lostpointercapture', { bubbles: true }), { pointerId: 1 }));
  expect(bar).not.toHaveClass('is-pressed');
  // Und der nächste Druck wird wieder angenommen.
  fireEvent.pointerDown(bar, { pointerId: 2, button: 0, clientX: 10, clientY: 10 });
  expect(bar).toHaveClass('is-pressed');
});

it('nimmt den ersten Tastatur-Klick auch unmittelbar nach dem App-Start an', () => {
  vi.spyOn(performance, 'now').mockReturnValue(50);
  render(<MemoryRouter initialEntries={['/']}><Layout /></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name: 'Album' }), { detail: 0 });
  expect(screen.getByRole('link', { name: 'Album' })).toHaveAttribute('aria-current', 'page');
});

it('verwirft Loslassen weit neben der Tab-Leiste und blockiert danach keine Tastaturbedienung', () => {
  render(<MemoryRouter initialEntries={['/pegel']}><Layout /></MemoryRouter>);
  const bar = document.querySelector('.tabbar__inner')!;
  bar.getBoundingClientRect = () => ({ left: 0, right: 400, top: 0, bottom: 60, width: 400, height: 60 }) as DOMRect;
  const pointer = (type: string, x: number) => fireEvent(bar,
    Object.assign(new Event(type, { bubbles: true }), { pointerId: 1, button: 0, clientX: x, clientY: 30 }),
  );
  pointer('pointerdown', 250);
  pointer('pointermove', 700);
  pointer('pointerup', 700);
  expect(screen.getByRole('link', { name: 'Pegel' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('link', { name: 'Album' }), { detail: 0 });
  expect(screen.getByRole('link', { name: 'Album' })).toHaveAttribute('aria-current', 'page');
});

it('folgt der Systemdarstellung live und respektiert anschließend eine feste Wahl', async () => {
  const { useApp } = await import('../store/app');
  const media = new EventTarget();
  const query = Object.assign(media, { matches: false });
  vi.stubGlobal('matchMedia', () => query);
  useApp.setState({ theme: 'system' });
  const { act } = await import('@testing-library/react');
  render(<MemoryRouter><Layout /></MemoryRouter>);
  expect(document.documentElement.dataset.theme).toBe('light');
  act(() => { query.matches = true; media.dispatchEvent(new Event('change')); });
  expect(document.documentElement.dataset.theme).toBe('dark');
  act(() => useApp.getState().setTheme('light'));
  act(() => { query.matches = true; media.dispatchEvent(new Event('change')); });
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('fokussiert nach Pfadwechsel die Hauptüberschrift und lässt Hashwechsel aus', async () => {
  const { Link, Route, Routes } = await import('react-router-dom');
  render(<MemoryRouter><Routes><Route element={<Layout />}>
    <Route path="/" element={<><h1>Start</h1><Link to="/neu">Weiter</Link></>} />
    <Route path="/neu" element={<><h1>Neue Seite</h1><Link to="#abschnitt">Abschnitt</Link></>} />
  </Route></Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name: 'Weiter' }));
  expect(screen.getByRole('heading', { name: 'Neue Seite' })).toHaveFocus();
  const anchor = screen.getByRole('link', { name: 'Abschnitt' });
  anchor.focus(); fireEvent.click(anchor);
  expect(anchor).toHaveFocus();
});

it('nutzt bei Seiten ohne h1 den Titel der Navigationsleiste als Hauptüberschrift', async () => {
  const { Route, Routes } = await import('react-router-dom');
  const { NavBar } = await import('../components/ui');
  render(<MemoryRouter><Routes><Route element={<Layout />}>
    <Route path="/" element={<NavBar title="Pegel" />} />
  </Route></Routes></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1, name: 'Pegel' })).toHaveFocus();
});

it('lässt einem Eingabefeld mit autoFocus auf der neuen Seite den Fokus', async () => {
  const { Link, Route, Routes } = await import('react-router-dom');
  render(<MemoryRouter><Routes><Route element={<Layout />}>
    <Route path="/" element={<><h1>Start</h1><Link to="/feld">Weiter</Link></>} />
    <Route path="/feld" element={<><h1>Mit Feld</h1><input aria-label="Begriff" autoFocus /></>} />
  </Route></Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name: 'Weiter' }));
  expect(screen.getByRole('textbox', { name: 'Begriff' })).toHaveFocus();
});
