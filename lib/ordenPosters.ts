// Orden de las series y de los pósters, el mismo que en Stock
// (app/inventario/page.tsx, restock y cierre tienen su propia copia).

export const SERIES_ORDER = [
  "Life is Food - Kitchen", "Animals", "Fun", "Frases",
  "Bauhaus", "Berlin Prints", "Berlin Botanica", "Cocina",
];

export const POSTERS_ORDER: { [serie: string]: string[] } = {
  "Life is Food - Kitchen": [
    "Garlic", "Onion", "Gurke", "Egg plant", "Limes", "Oranges",
    "Paprika fever", "Capuccino fever", "Kaffee beans", "Croissants", "Mushrooms", "Sushi",
  ],
  "Animals": [
    "Octopus", "The Boss Cat (Red)", "The Boss Cat (Yellow)",
    "My dog is super chill", "Gato trippy", "Miau",
  ],
  "Fun": [
    "Best Seat Vintage", "Microdose", "Mit Karte Bitte", "Fick Dich", "Harry Pommes",
    "U make me feel high pink", "U make me feel high blue", "Ready for your shit",
    "Expresso yourself", "Keep your spirit high", "Clean is Good", "Stay Chili",
  ],
  "Frases": [
    "Genau", "Berlin", "Schön", "Danke", "Bitte", "Alles Klar",
    "Genau Vortice", "Genau dit lauf shon",
  ],
  "Bauhaus": [
    "01 Orange chair", "02 Blue sky chair", "03 Blue sky building", "04 Blue building",
    "05 Orange house", "06 Yellow house", "07 Blue Orange House", "08 Black chair", "09 Bowie BH",
  ],
  "Berlin Prints": [
    "Berlin Döner", "Mauerpark Flower", "Wie Geht's? - Mauerpark",
    "Berlin Mauerpark - vintage girl", "Neukölln graffiti", "Brandenburger Tor",
    "Kreuzberg 36", "I love Berlin", "Ick bin Bearliner", "Berlin Disco Ball",
  ],
  "Berlin Botanica": [
    "Mitte", "Kreuzberg", "Neukölln", "Schöneberg", "Prenzlauer Berg",
    "Wedding", "Friedriechshain", "Lichtenberg", "Charlottenburg", "Moabit", "Pankow", "Spandau",
  ],
  "Cocina": [
    "Siracha", "Negroni", "Prost", "All we need is Ramen",
  ],
};

/** Posición de un póster dentro de su serie (los que no están en la lista van al final). */
export function posicionEnSerie(serie: string, nombre: string): number {
  const i = (POSTERS_ORDER[serie] || []).indexOf(nombre);
  return i === -1 ? 99 : i;
}

/** Posición de una serie (las que no están en la lista van al final). */
export function posicionSerie(serie: string): number {
  const i = SERIES_ORDER.indexOf(serie);
  return i === -1 ? 99 : i;
}
