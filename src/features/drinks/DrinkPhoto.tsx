import beer from '../../assets/drinks/cutout-beer.webp';
import wine from '../../assets/drinks/cutout-wine.webp';
import mixed from '../../assets/drinks/cutout-mixed.webp';

// Drei freigestellte Kontaktboegen mit je sechs Getraenken.
// Ausschnitt per CSS: nur drei Bilddateien statt 18 Netzwerkanfragen.
const photos: Record<string, { sheet: string; index: number }> = {
  'beer-pils': { sheet: beer, index: 0 },
  'beer-helles': { sheet: beer, index: 1 },
  'beer-wheat': { sheet: beer, index: 2 },
  'beer-radler': { sheet: beer, index: 3 },
  'beer-ipa': { sheet: beer, index: 4 },
  'wine-white': { sheet: beer, index: 5 },
  'wine-red': { sheet: wine, index: 0 },
  'wine-rose': { sheet: wine, index: 1 },
  sparkling: { sheet: wine, index: 2 },
  aperol: { sheet: wine, index: 3 },
  cocktail: { sheet: wine, index: 4 },
  'cocktail-strong': { sheet: wine, index: 5 },
  longdrink: { sheet: mixed, index: 0 },
  'hard-seltzer': { sheet: mixed, index: 1 },
  'shot-schnaps': { sheet: mixed, index: 2 },
  'shot-liqueur': { sheet: mixed, index: 3 },
  'shot-tequila': { sheet: mixed, index: 4 },
  soft: { sheet: mixed, index: 5 },
};

export function DrinkPhoto({ id }: { id: string }) {
  const photo = photos[id];
  if (!photo) return null;
  return (
    <span
      className="drink-photo"
      aria-hidden="true"
      style={{
        backgroundImage: `url(${photo.sheet})`,
        backgroundPosition: `${(photo.index % 3) * 50}% ${Math.floor(photo.index / 3) * 100}%`,
      }}
    />
  );
}
