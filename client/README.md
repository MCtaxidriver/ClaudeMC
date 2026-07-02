# ClaudeCraft – Voxel-Survival (Minecraft-Prototyp)

Browserbasiertes 3D-Voxel-Spiel mit Three.js. Läuft komplett offline: Three.js
liegt lokal unter `vendor/`, alle Texturen und Mob-Modelle werden zur Laufzeit
prozedural generiert – oder aus einem offiziellen Minecraft-Ressourcen-Pack
geladen (siehe `texturepack/LIES-MICH.txt`).

## Starten

Lokalen Webserver im Projektordner starten (ES-Module laufen nicht per
Doppelklick):

```
python -m http.server 8642
```

Danach öffnen: http://localhost:8642 · Optional fester Seed: `?seed=1337`

## Der Weg zum Enderdrachen (wie in Minecraft)

1. Holz hacken → Werkbank → Werkzeuge (Holz → Stein → Eisen → Diamant)
2. Erze abbauen: Kohle, Eisen (Ofen zum Schmelzen!), Gold, Diamant, Smaragd
3. Portalruine finden (Kompass im Debug-HUD), Feuerzeug craften
   (Eisenbarren + Feuerstein aus Kies) und das Portal **anzünden**
4. Im Nether **Blazes** jagen → Lohenruten → Lohenstaub
5. Nachts **Endermen** besiegen (oder beim Dorfbewohner tauschen) → Enderperlen
6. Lohenstaub + Enderperle → **Enderauge**. Rechtsklick wirft ein Auge, das
   Richtung Festung fliegt (Distanz siehe HUD)
7. Festung ausgraben, alle **12 Portalrahmen** mit Enderaugen füllen → End-Portal
8. Im End: Kristalle auf den Obsidiansäulen zerstören (sie heilen den Drachen),
   dann den **Enderdrachen** besiegen (Boss-Bar oben)
9. Erst nach seinem Tod öffnet sich das Exit-Portal in der Mitte – oben drauf
   liegt das **Drachenei** als Trophäe

## Features

### Survival
- Abbauzeiten + Werkzeugstufen: Holz/Stein/Eisen/Diamant (Spitzhacke, Axt,
  Schaufel, Schwert). Diamanterz braucht Eisenspitzhacke, Obsidian Diamant
- **Rüstung**: Leder/Eisen/Diamant (Helm, Harnisch, Hose, Stiefel) mit
  Rüstungsanzeige und Schadensreduktion
- **Ofen**: Eisen/Gold schmelzen, Fleisch braten, Bruchstein → Stein,
  Holz → Holzkohle. Brennstoffe: Kohle, Holz, Lohenruten
- Essen per Rechtsklick (Apfel, Steak, Braten, Goldapfel heilt sofort)
- Hunger, Ertrinken, Fallschaden, Lava, Regeneration
- **Tod**: Inventar + Rüstung fallen am Todesort und können wieder
  eingesammelt werden (Koordinaten stehen im Todesbildschirm, Drops überleben
  Speichern/Laden)
- Q wirft das gehaltene Item weg

### Crafting
- **Geformte Rezepte wie in Minecraft** (Position im Raster zählt, verschieben/
  spiegeln erlaubt): Werkzeuge, Schwerter, Rüstung, Ofen, Werkbank,
  Feuerzeug, Lohenstaub, Enderauge, Goldapfel, Steinziegel
- 2x2 im Inventar, 3x3 an der Werkbank

### Mobs
- Feindlich: Zombie, Skelett (Pfeile), Creeper (Explosion), **Blaze** (Nether,
  Feuerball-Salven), **Enderman** (neutral – anschauen macht ihn wütend,
  teleportiert sich, hasst Wasser)
- Friedlich: Schaf, Kuh (Leder!), **Dorfbewohner** in Dörfern
- **Handel**: Rechtsklick auf Dorfbewohner – Smaragde gegen Essen, Werkzeug,
  Enderperlen und Diamanten
- **Enderdrache**: Boss im End mit Boss-Bar, Sturzflügen, Landephasen auf dem
  Portal und heilenden End-Kristallen

### Welt & Dimensionen
- Biome, Dörfer, **inaktive Portalruinen** (mit Feuerzeug zünden),
  unterirdische **Festungen** mit End-Portalrahmen
- Erze: Kohle, Eisen, Gold, Diamant, Smaragd, Kies (droppt Feuerstein)
- **Nether**: sichere Ankunft (Portal-Plattform wird immer gebaut, nie über
  Lava), Blazes, Glowstone
- **End**: schwebende Insel, Obsidiansäulen mit Kristallen, Exit-Portal öffnet
  erst nach dem Drachen-Tod, Drachenei
- Tag/Nacht mit Sonne, Mond und Sternen; Schwimmen mit Auftrieb und
  automatischem Herausklettern am Ufer
- Prozedurale Sounds (Abbauen, Essen, Treffer, Explosionen, Drache …)

### Texturen
- Standard: prozedural generiert (keine Assets nötig)
- Optional: offizielles Minecraft-Ressourcen-Pack nach `texturepack/`
  entpacken → Block- und Item-Texturen werden automatisch übernommen

## Steuerung

| Taste | Aktion |
|---|---|
| WASD / Maus | Bewegen / Umsehen |
| Leertaste | Springen / Schwimmen |
| Shift | Sprinten (braucht Hunger > 6) |
| Linksklick halten | Block abbauen / Mob angreifen |
| Rechtsklick | Platzieren · Essen · Benutzen (Werkbank, Ofen, Handel, Feuerzeug, Enderauge) |
| E | Inventar öffnen/schliessen |
| Q | Gehaltenes Item wegwerfen |
| 1–9 / Mausrad | Hotbar-Slot wählen |
| Esc | Pause (Speichern, Hauptmenü) |

## Dateistruktur

```
mc/
├── index.html        Einstieg, Menüs, HUD, Boss-Bar, Importmap (lokal)
├── style.css         HUD, Inventar/Ofen/Handel-UI, Menüs
├── texturepack/      Hier optional offizielles Ressourcen-Pack entpacken
├── vendor/
│   └── three.module.js   Three.js r164 (lokal, offline-fähig)
└── js/
    ├── config.js     Konstanten (Physik, Spawning, Tageslänge …)
    ├── noise.js      Seedbarer Perlin-Noise (2D/3D) + fBm
    ├── blocks.js     34 Blocktypen (Härte/Werkzeugstufe/Drops) + Texturatlas
    ├── items.js      Werkzeuge/Rüstung/Essen/Materialien, Schmelz-/Brennstoff-Tabellen
    ├── texpack.js    Loader für offizielle Minecraft-Ressourcen-Packs
    ├── structures.js Dörfer, Portalruinen, Festungen (deterministisch)
    ├── world.js      Chunks, Generatoren (Overworld/Nether/End), Erze, Meshing
    ├── entities.js   Mobs + KI, Enderdrache, End-Kristalle, Projektile, Drops
    ├── player.js     First-Person-Physik, Schwimmen, HP/Hunger/Rüstung
    ├── inventory.js  Inventar, geformte Rezepte, Ofen-/Handel-UI
    ├── sound.js      Prozedurale WebAudio-Sounds
    ├── save.js       Speicherslots (localStorage)
    └── main.js       Game-Loop, Dimensionen, Portale, Drachen-Fight, HUD
```

## Bekannte Grenzen (Prototyp)

- Wasser/Lava fliessen nicht
- Keine Werkzeug-Haltbarkeit, keine Verzauberungen, kein Bogen
- Beleuchtung ist global (Tag/Nacht), keine lokalen Lichtquellen
- End-Kristalle sind nur im Nahkampf zerstörbar (hochbauen!)
