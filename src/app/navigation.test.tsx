import { afterEach, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useGoBack, useNavDirection } from './navigation';

function Detail() {
  const goBack = useGoBack('/');
  return <button onClick={goBack}>Zurück</button>;
}
function Home() {
  const nav = useNavigate();
  return (
    <>
      <p>Start</p>
      <button onClick={() => nav('/detail')}>Öffnen</button>
    </>
  );
}
function App() {
  useNavDirection();
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/detail" element={<Detail />} />
    </Routes>
  );
}

afterEach(() => {
  delete document.documentElement.dataset.nav;
});

it('führt bei einem direkt geöffneten Link in die App statt aus ihr heraus', () => {
  render(
    <MemoryRouter initialEntries={['/detail']}>
      <App />
    </MemoryRouter>,
  );
  expect(document.documentElement.dataset.nav).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
  expect(screen.getByText('Start')).toBeInTheDocument();
  expect(document.documentElement.dataset.nav).toBe('back');
});

it('geht mit Verlauf einen Schritt zurück und merkt sich die Richtung', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));
  expect(document.documentElement.dataset.nav).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
  expect(await screen.findByText('Start')).toBeInTheDocument();
  expect(document.documentElement.dataset.nav).toBe('back');
  // Vorwärts ist wieder die normale Richtung.
  fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));
  expect(document.documentElement.dataset.nav).toBeUndefined();
});
