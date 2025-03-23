# POC plan intéractif de l'aéroport Euroairport (EAP)

## Choix techniques

Utilisation de :
* la bibliothèque libre Maplibre (fork libre de Mapbox GL JS)
* les fonds de carte Protomaps (voir le gros fichier eap.pmtiles qui contient les tuiles autour de l'aéroport)

## TODO

Gestion des catégories à plusieurs niveaux
Ergonomie générale des filtres (contenu barre de gauche)
Passage de paramètres dans l'URL pour arriver sur le plan avec catégorie ou niveau ou POI préselectionné
Carto : 
* Voir si on garde la layer symbol avec ses limites (icônes PNG, trop d'images à charger sans sprite) ou si on revient aux Marker
* Si choix marker : https://stackoverflow.com/a/55828753 ou https://stackoverflow.com/a/55917076
* Si on conver symbol, voir si on garde layer symbol ou circle ou un mix des 2
Fermer popup sur une action : https://stackoverflow.com/a/59848998 ou https://stackoverflow.com/a/63006609
Prévoir un ajustement de la carte sur les éléments affichés
Intégrer avec Drupal (actuellement des (geo)json codés en dur)
Documenter le setStyle https://github.com/maplibre/maplibre-gl-js/issues/2587 + https://docs.mapbox.com/mapbox-gl-js/example/style-switch/
Documenter l'extraction des tuiles Protomaps
Documenter l'usage Vite et Github pages :
* https://til.simonwillison.net/gis/pmtiles
* https://til.simonwillison.net/github-actions/vite-github-pages