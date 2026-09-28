/**
 * Zeigt die Kachel-Motive. Ohne Parameter alle nebeneinander (Übersicht),
 * mit `?id=<spiel>` genau eines in 360 × 480 – so fotografiert es render.mjs.
 */
import { createRoot } from 'react-dom/client';
// Für die Schrift (Anton) – dieselbe wie in der App.
import '../../src/styles/global.css';
import { Atmosphere, Defs, SCENES, Vignette, type Scene } from './scenes';

function Tile({ scene }: { scene: Scene }) {
  const Art = scene.art;
  return (
    <svg
      id={`tile-${scene.id}`}
      width={360}
      height={480}
      viewBox="0 0 360 480"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <Defs light={scene.light} mid={scene.mid} deep={scene.deep} />
      <rect width={360} height={480} fill="url(#bg)" />
      <Atmosphere color={scene.light} seed={scene.id.length} />
      <Art />
      <Vignette />
    </svg>
  );
}

// Übersicht: jedes Motiv in einem eigenen Rahmen. Im selben Dokument teilten
// sich alle Szenen die IDs ihrer Verläufe, und alle sähen gleich aus.
const id = new URLSearchParams(location.search).get('id');
const scene = SCENES.find((s) => s.id === id);
createRoot(document.getElementById('root')!).render(
  scene ? (
    <Tile scene={scene} />
  ) : (
    <>
      {SCENES.map((s) => (
        <iframe
          key={s.id}
          title={s.id}
          src={`?id=${s.id}`}
          width={360}
          height={480}
          style={{ border: 0 }}
        />
      ))}
    </>
  ),
);
