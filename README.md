# POC plan intéractif de l'aéroport Euroairport (EAP)

## Choix techniques

Utilisation de :
* la bibliothèque libre Maplibre (fork libre de Mapbox GL JS)
* les fonds de carte Protomaps (voir le gros fichier eap.pmtiles qui contient les tuiles autour de l'aéroport)

## Installation

Projet Vite classique ("vanilla"), donc :

```
npm install
npm run dev # en local
```

ou 

```
npm run build # en prod => c'est ce qui est fait dans Github pages, cf contenu `.github`
```

## TODO

- [x] Gestion des catégories à plusieurs niveaux

- [x] Mettre le lien GeoJSON de l'état dans eap-levels.json

- [x] Ergonomie générale des filtres (contenu barre de gauche)

- [ ] Mettre en évidence l'étage sélectionné dans la barre de droite

- [ ] Passage de paramètres dans l'URL pour arriver sur le plan avec catégorie ou niveau ou POI préselectionné

- [ ] Carto : 
* Voir si on garde la layer symbol avec ses limites (icônes PNG, trop d'images à charger sans sprite) ou si on revient aux Marker
* Si choix marker : https://stackoverflow.com/a/55828753 ou https://stackoverflow.com/a/55917076
* Si on converse symbol, voir si on garde layer symbol ou circle ou un mix des 2
* piste = mix des 2 : https://github.com/mapbox/mapbox-gl-js/issues/3605#issuecomment-290330684

- [x] Fermer popup sur une action : https://stackoverflow.com/a/59848998 ou https://stackoverflow.com/a/63006609

- [ ] Prévoir un ajustement/centrage de la carte sur les éléments affichés : https://stackoverflow.com/questions/45770260/how-to-get-the-results-of-a-filtered-mapbox-layer et https://docs.mapbox.com/mapbox-gl-js/example/fitbounds/

- [x] Intégrer avec Drupal (actuellement des (geo)json codés en dur)

## A documenter

- [ ] Documenter le setStyle https://github.com/maplibre/maplibre-gl-js/issues/2587 + https://docs.mapbox.com/mapbox-gl-js/example/style-switch/

- [ ] Documenter l'extraction des tuiles Protomaps

- [ ] Documenter l'usage Vite et Github pages :
* https://til.simonwillison.net/gis/pmtiles
* https://til.simonwillison.net/github-actions/vite-github-pages

- [ ] Positionner un ID sur chaque feature dans QGis : https://gis.stackexchange.com/a/132859

- [ ] usage général de QGis :
* charger une image, géoréférencer
* faire des vrais carrés/rectangles
* gestion des (faux) arrondis
* éditer un polygone, découper/merger
* table des attributs, filtres
* export GeoJSON, notion de précision
* sujets spécifiques EAP (ground, color, height pour extrusion)