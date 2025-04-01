import './style.scss';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { Protocol } from "pmtiles";

import { layers, namedFlavor } from '@protomaps/basemaps';

document.addEventListener('DOMContentLoaded', function () {

    // Position initiale de la carte + emprise maximum autorisée
    // On interdit le zoom trop loin en dehors de l'aéroport
    const initial_center = [7.53, 47.599];
    const initial_zoom = 14;
    const bounds = [[7.46, 47.57], [7.60, 47.63]];

    // Variables globales ci dessous
    let map;

    let levels = [];

    let poiLoaded = false;
    let pois = [];
    let poiLoadedImages = [];

    let categories = [];

    let currentLevel = null;
    let currentCategory = null;

    // Structure commune entre tous les styles Protomaps
    // Valeurs possibles pour flavor dark, white, grayscale, light
    // Ici on ne permet qu'une bascule entre dark et light
    // https://docs.protomaps.com/basemaps/flavors
    const protomapsCommonStyle = {
        version: 8,
        glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
        sources: {
            'eap': {
                type: 'vector',
                // Voir https://til.simonwillison.net/gis/pmtiles pour l'usage des location.*
                url: `pmtiles://${location.protocol}//${location.host}${location.pathname}/protomaps/eap.pmtiles`,
                attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>'
            },
        },

    };

    const protomapsDarkStyle = {
        sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/dark',
        layers: layers("eap", {
            ...namedFlavor("dark"),
            ...{ pois: undefined } // https://github.com/protomaps/basemaps/issues/80#issuecomment-2663159851
        },
            { lang: "en" }
        ),
        ...protomapsCommonStyle
    };

    const protomapsLightStyle = {
        sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
        layers: layers("eap", {
            ...namedFlavor("light"),
            ...{ pois: undefined } // https://github.com/protomaps/basemaps/issues/80#issuecomment-2663159851
        },
            { lang: "en" }
        ),
        ...protomapsCommonStyle
    };

    // Créé le sélecteur d'étages, à terme viendra d'un JSON fournit par Drupal (taxo)
    async function createLevelSwitcherControl() {
        try {
            const url = 'json/eap-levels.json';
            let response = await fetch(url);
            if (!response.ok)
                throw new Error(response.statusText);
            let levels = await response.json();
            console.log("levels", levels);
            const ulElement = document.querySelector('.interactive-plan__level');
            for (const level of levels) {
                const levelId = level.id;
                const levelName = level.name ?? 'Unknown';
                let liElement = document.createElement("li", { is: "expanding-list" });
                let buttonElement = document.createElement("button");
                buttonElement.innerText = levelName;
                buttonElement.classList.add("interactive-plan__level__btn");
                buttonElement.dataset.level = levelId;
                // TODO add click listener
                liElement.append(buttonElement);
                ulElement.append(liElement);
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Créé le sélecteur de catégories de POI à partir de la liste de catégories découverte dans la liste des POI
    async function createCategorySwitcherControl() {
        try {
            const url = 'json/eap-categories.json';
            let response = await fetch(url);
            if (!response.ok)
                throw new Error(response.statusText);
            categories = await response.json();
            console.log("categories", categories);
            const ulElement = document.querySelector('.interactive-plan__category');
            for (const category of categories) {
                const categoryId = category.id;
                const categoryName = category.name ?? 'Unknown';
                const categoryIcon = category.icon;
                let liElement = document.createElement("li", { is: "expanding-list" });

                let imgElement = document.createElement("img");
                imgElement.src = categoryIcon;

                let spanElement = document.createElement("span");
                spanElement.appendChild(imgElement);

                let buttonElement = document.createElement("button");
                const textNode = document.createTextNode(categoryName);
                buttonElement.classList.add("interactive-plan__category__btn");
                buttonElement.dataset.category = categoryId;
                buttonElement.addEventListener('click', handleCategoryButtonClick);

                buttonElement.appendChild(spanElement);
                buttonElement.appendChild(textNode);

                liElement.append(buttonElement);

                ulElement.append(liElement);
            }
        } catch (err) {
            console.error(err);
        }
    }

    function createMap(styleConfig) {
        if (map) {
            map.remove();
        }

        console.log('createMap');

        let protocol = new Protocol();
        maplibregl.addProtocol("pmtiles", protocol.tile);

        map = new maplibregl.Map({
            container: 'map',
            style: styleConfig,
            center: initial_center,
            zoom: initial_zoom,
            maxBounds: bounds,
            bearing: 245,
            antialias: true
        });
        map.addControl(new maplibregl.NavigationControl());

        // Charger les données une fois la carte chargée
        map.on('load', function () {
            loadPOIGeoJSON();

            // TODO Appeler la fonction pour appliquer les paramètres de l'URL
            // applyURLParams();
        });
    }

    function getSystemDarkLightTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function setMapTheme(styleConfig) {
        map.setStyle(styleConfig,
            {
                transformStyle: (previousStyle, nextStyle) => {
                    var custom_layers = previousStyle.layers.filter(layer => {
                        return layer.id.startsWith('eap-')
                    });
                    var layers = nextStyle.layers.concat(custom_layers);

                    var sources = nextStyle.sources;
                    for (const [key, value] of Object.entries(previousStyle.sources)) {
                        if (key.startsWith('eap-')) {
                            sources[key] = value;
                        }
                    }
                    return {
                        ...nextStyle,
                        sources: sources,
                        layers: layers
                    };
                }
            }
        );
    }

    function updateThemeButtonText() {
        const button = document.querySelector('.interactive-plan__switch');
        if (button) {
            button.textContent = currentTheme === 'dark' ? 'Light' : 'Dark';
        }
    }

    // Chargement des niveaux de l'aéroport + création du switcher sur la droite
    createLevelSwitcherControl();
    // Chargement des catégories de POI, chargement des icônes associées
    // et création du switcher dans la barre de gauche
    createCategorySwitcherControl();

    // Gestion du switcher de theme dark/light
    let currentTheme = getSystemDarkLightTheme();
    updateThemeButtonText();
    let styleConfig = currentTheme === 'dark' ? protomapsDarkStyle : protomapsLightStyle;

    // Création de la carte (puis chargement des POIs)
    createMap(styleConfig);

    // TODO gérer le changement de pref system utilisateur
    /*window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        currentTheme = e.matches ? 'dark' : 'light';
        setMapTheme(currentTheme);
    });*/

    document.querySelector('.interactive-plan__switch').addEventListener('click', (e) => {
        currentTheme = e.target.innerText.toLowerCase();
        updateThemeButtonText();
        styleConfig = currentTheme === 'dark' ? protomapsDarkStyle : protomapsLightStyle;
        setMapTheme(styleConfig);
    });

    // Ancien code de chargement du GEOJSON du premier POC de Antho
    /*function loadGeoJSON(type, level) {
        console.log('loadGeoJSON', type, level)
        const url = type === 'level'
            ? `json/level_${level}.geojson`
            : `json/parking_${level}.geojson`;
  
        fetch(url)
            .then(response => response.ok ? response.json() : Promise.reject(`GeoJSON file not found: ${url}`))
            .then(data => {vis
                if (!data) return;
  
                data.features.forEach((feature, index) => {
                    const featureType = feature.properties.type;
                    const icon = feature.properties.icon;
                    const layerId = `${type}_${feature.id || index}`;
                    console.log('layerId', layerId);
                    map.addSource(layerId, {
                        'type': 'geojson',
                        'data': feature
                    });
  
                    if (featureType !== 'stair-poi') {
                        map.addLayer({
                            'id': `${layerId}_fill`,
                            'type': 'fill-extrusion',
                            'source': layerId,
                            'paint': {
                                'fill-extrusion-color': ['get', 'color'],
                                'fill-extrusion-height': ['get', 'height'],
                                'fill-extrusion-base': 0,
                                'fill-extrusion-opacity': featureType === 'parking' ? 0.5 : 1
                            }
                        });
                    }
  
                    if (featureType === 'stair-poi') {
                        map.addLayer({
                            'id': `${layerId}_fill`,
                            'type': 'fill',
                            'source': layerId,
                            'paint': {
                                'fill-color': ['get', 'color'],
                                'fill-opacity': 0.3
                            }
                        });
  
                        map.addLayer({
                            'id': `${layerId}_outline`,
                            'type': 'line',
                            'source': layerId,
                            'paint': {
                                'line-color': ['get', 'color'],
                                'line-width': 3,
                                'line-opacity': 0.7,
                                'line-dasharray': [3, 3],
                            }
                        });
                    }
  
                    if (featureType === 'ground') {
                        map.addLayer({
                            'id': `${layerId}_outline`,
                            'type': 'line',
                            'source': layerId,
                            'paint': {
                                'line-color': '#429cf8',
                                'line-width': 1
                            }
                        });
                    }
  
                    if (icon) {
  
                        map.on('mousemove', `${layerId}_fill`, () => {
                            if (!modalActive) {
                                map.setPaintProperty(`${layerId}_fill`, 'fill-extrusion-color', '#2679e3');
                                map.getCanvas().style.cursor = 'pointer';
                            }
                        });
  
                        map.on('mouseleave', `${layerId}_fill`, () => {
                            if (!modalActive) {
                                map.setPaintProperty(`${layerId}_fill`, 'fill-extrusion-color', ['get', 'color']);
                                map.getCanvas().style.cursor = '';
                            }
                        });
  
                        map.on('click', `${layerId}_fill`, (e) => {
                            const center = turf.centerOfMass(feature);
                            const coordinates = center.geometry.coordinates;
  
                            map.setPaintProperty(`${layerId}_fill`, 'fill-extrusion-color', '#0035AD');
                            showModal(feature, layerId);
  
                            map.flyTo({
                                center: coordinates,
                                zoom: 20,
                                essential: true
                            });
                        });
  
  
                        const center = turf.centerOfMass(feature);
                        const coordinates = center.geometry.coordinates;
  
                        const el = document.createElement('div');
                        el.className = 'marker';
                        el.style.backgroundImage = `url('images/icons/${icon}.png')`;
  
                        el.addEventListener('click', () => {
                            showModal(feature);
                            map.flyTo({
                                center: coordinates,
                                zoom: 20,
                                essential: true
                            });
                        });
  
                        new maplibregl.Marker({ element: el })
                            .setLngLat(coordinates)
                            .addTo(map);
                    }
                });
            })
            .catch(error => {
                console.error('Error loading GeoJSON:', error);
            });
    }*/

    function hideAllLevels() {
        for (const level of levels) {
            console.log(`On cache le niveau ${level}`);
            const layerId = 'eap-layer-level' + level;
            map.setLayoutProperty(layerId, 'visibility', 'none');
            map.setLayoutProperty(layerId + '-extrusion', 'visibility', 'none');
        }
    }

    function applyFilters() {
        console.log(`On applique les filtres currentCategory=${currentCategory} currentLevel=${currentLevel}`)
        loadPOIGeoJSON();

        // Ici on gère l'affichage des POI
        if (currentCategory != null && currentLevel == null) {
            console.log(`Filtrage des POI par la catégorie ${currentCategory}`);
            map.setFilter('eap-layer-poi', ['==', 'category', currentCategory]);
            map.setLayoutProperty('eap-layer-poi', 'visibility', 'visible');
        } else if (currentCategory == null && currentLevel != null) {
            console.log(`Filtrage des POI par l'étage ${currentLevel}`);
            map.setFilter('eap-layer-poi', ['==', 'level', currentLevel]);
            map.setLayoutProperty('eap-layer-poi', 'visibility', 'visible');
        } else if (currentCategory != null && currentLevel != null) {
            console.log(`Filtrage des POI par l'étage ${currentLevel} et la catégorie ${currentCategory}`);
            map.setFilter('eap-layer-poi', [
                "all",
                ['==', 'level', currentLevel],
                ['==', 'category', currentCategory]
            ]
            );
            map.setLayoutProperty('eap-poi-layer', 'visibility', 'visible');
        } else {
            console.log(`Pas de filtrage des POI`);
            map.setFilter('eap-layer-poi', null);
            map.setLayoutProperty('eap-poi-layer', 'visibility', 'visible');
        }

        // Ici on gère l'affichage (ou non) de l'étage
        hideAllLevels();
        if (currentLevel != null) {
            console.log(`Affichage de l'étage ${currentLevel}`);
            loadLevelGeoJSON(currentLevel)
            const layerId = 'eap-layer-level' + currentLevel;
            map.setLayoutProperty(layerId, 'visibility', 'visible');
            map.setLayoutProperty(layerId + '-extrusion', 'visibility', 'visible');
        }
    }

    // Chargement d'un GeoJSON décrivant l'étage sélectionné
    function loadLevelGeoJSON(level) {
        console.log('loadLevelGeoJSON', level)
        const url = `json/eap-level_${level}.geojson`;

        if (!levels.includes(level)) {
            console.log(`Level ${level} never loaded => requesting`);
            levels.push(level);

            // TODO passer en try/catch + await pour harmoniser avec chargement des catégories
            fetch(url)
                .then(response => response.ok ? response.json() : Promise.reject(`GeoJSON file not found: ${url}`))
                .then(data => {
                    if (!data) return;

                    const sourceId = 'eap-source-level' + level;
                    const layerId = 'eap-layer-level' + level;
                    map.addSource(sourceId, {
                        'type': 'geojson',
                        'data': data
                    });

                    // Ajout d'une layer pour le contour du sol (=> "ground")
                    // Couleur rouge/bleu pour FR/CH
                    map.addLayer({
                        'id': layerId,
                        'type': 'fill',
                        'source': sourceId,
                        'paint': {
                            'fill-outline-color': 'black',
                            'fill-color': ['coalesce', ['get', 'color'], '#aaaaaa'],
                            'fill-opacity': 0.7,
                        },
                        'filter': ['==', 'type', 'ground']
                    }, 'eap-layer-poi');

                    // Ajout d'une deuxième layer en 3D pour la hauteur des bâtiments internes de l'étage
                    map.addLayer({
                        'id': layerId + '-extrusion',
                        'type': 'fill-extrusion',
                        'source': sourceId,
                        'paint': {
                            'fill-extrusion-color':
                                [
                                    'match',
                                    ['get', 'type'],
                                    'building', '#ccc',
                                    'shop', '#d8256e',
                                    'bar', '#2535f4',
                                    'belt', '#555',
                                    'check', '#555',
                                    'gate', '#050',
                                    'toilets', '#ffc000',
                                    'stairs', '#111',
                          /* other */ '#ccc'
                                ],
                            'fill-extrusion-height':
                                [
                                    'match',
                                    ['get', 'type'],
                                    'building', 4,
                                    'shop', 4,
                                    'bar', 4,
                                    'belt', 1,
                                    'check', 2,
                                    'gate', 2,
                                    'toilets', 4,
                                    'stairs', 2,
                          /* other */ 0
                                ],
                            'fill-extrusion-base': 0,
                            'fill-extrusion-opacity': 0.8
                        },
                        'filter': [
                            'in',
                            ['get', 'type'],
                            ['literal',
                                [
                                    'building',
                                    'shop',
                                    'bar',
                                    'belt',
                                    'check',
                                    'gate',
                                    'toilets',
                                    'stairs',
                                ]
                            ]
                        ]
                    }, 'eap-layer-poi');
                    /*map.once('sourcedata', (e) => {
                        console.log('loadLevelGeoJSON => sourcedata', e)
                    });
                    map.once('data', (e) => {
                        console.log('loadLevelGeoJSON => data', e)
                    });*/
                })
                .catch(error => {
                    console.error('Error loading GeoJSON:', error);
                });
        }
    }

    async function loadPOIGeoJSON() {
        console.log('loadPOIGeoJSON');

        if (!poiLoaded) {
            try {
                const url = 'json/eap-poi.geojson';
                let response = await fetch(url);
                if (!response.ok)
                    throw new Error(response.statusText);
                pois = await response.json();
                console.log("pois", pois);

                for (const poi of pois.features) {
                    console.log(`Traitement du POI ${poi.properties.name} de catégorie ${poi.properties.category}`);
                    const imageId = 'eap-' + poi.properties.category;

                    // Cherche l'icône associée au POI à partir de sa catégorie
                    const category = categories.find(c => c.id === poi.properties.category)
                    let icon = null;
                    if (category !== undefined) {
                        icon = category.icon;
                        if (!poiLoadedImages.includes(imageId)) {
                            console.log(`L'icône ${icon} de catégorie ${imageId} n'est pas encore connue de la carte, chargement`);
                            const image = await map.loadImage(icon);
                            map.addImage(imageId, image.data);
                            poiLoadedImages.push(imageId);
                        }
                    } else {
                        console.warn(`Le POI ${poi.properties.name} a une catégorie inconnue ${poi.properties.category}`);
                    }


                }

                const sourceId = 'eap-source-poi';
                const layerId = 'eap-layer-poi';
                map.addSource(sourceId, {
                    'type': 'geojson',
                    'data': pois
                });

                /* map.addLayer({
                    'id': layerId,
                    'type': 'circle',
                    'source': sourceId,
                    'paint': {
                        'circle-color': 'red',
                        'circle-radius': 5,
                        'circle-stroke-color': 'black',
                        'circle-stroke-width': 2,
  
                    }
                });*/

                map.addLayer({
                    'id': layerId,
                    'type': 'symbol',
                    'source': sourceId,
                    'layout': {
                        'icon-image': ['concat', 'eap-', ['get', 'category']],
                        'icon-size': 0.5,
                        'icon-allow-overlap': true,
                        // 'text-field': ['get', 'name'],
                    }
                });

                /*let bounds = turf.bbox(data);
                console.log(map);
                console.log(map.getBearing());
                console.log(map.getPitch());
                map.fitBounds(
                    bounds, 
                    {
                        padding: 20,
                        bearing: map.getBearing(),
                        pitch: map.getPitch(),
                    }
                );*/

                map.on('mouseenter', layerId, () => {
                    map.getCanvas().style.cursor = 'pointer'
                })
                map.on('mouseleave', layerId, () => {
                    map.getCanvas().style.cursor = ''
                })

                map.on('click', layerId, (e) => {
                    const coordinates = e.features[0].geometry.coordinates.slice();
                    const name = e.features[0].properties.name;
                    const level = e.features[0].properties.level;
                    const description = e.features[0].properties.description;

                    // TODO handle multiple features here
                    /*console.log('click', e);
                    if (e.features.length > 1)
                        console.warn('More than one feature, to be handled');
                    }*/

                    let popupContent = `<h3>${name}</h3><p><strong>Etage : ${level}</strong></p>`;
                    if (description) {
                        popupContent += `<p>${description}</p>`
                    } else {
                        popupContent += '<p>Pas de description</p>'
                    }

                    map.flyTo({
                        center: coordinates,
                        zoom: 20,
                        essential: true
                    });

                    new maplibregl.Popup()
                        .setLngLat(coordinates)
                        .setHTML(popupContent)
                        .addTo(map);
                });

                poiLoaded = true;
            } catch (err) {
                console.error(err);
            }
        }
    }

    /*function applyURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const initialLevel = urlParams.get('level') ? parseInt(urlParams.get('level'), 10) : null;
        const initialCategory = urlParams.get('category') || null;
  
        if (initialLevel) {
            //loadGeoJSON('parking', initialLevel); // Charger les parkings
            // loadGeoJSON('level', initialLevel);   // Charger le niveau
            loadLevelGeoJSON(2);
            loadPOIGeoJSON();
        }
  
        if (initialCategory) {
            currentCategory = initialCategory;
            applyFilter();
            document.querySelectorAll('.interactive-plan__category__btn').forEach(button => {
                button.classList.toggle('-active', button.getAttribute('data-type') === currentCategory);
            });
        }
    }*/

    document.querySelector('.interactive-plan__level').addEventListener('click', function (e) {
        let level = e.target?.getAttribute('data-level');
        level = parseInt(level, 10);
        if (level != null) {
            currentLevel = level === currentLevel ? null : level;
            document.querySelectorAll('.interactive-plan__level__btn').forEach(button => {
                button.classList.toggle('-active', button.getAttribute('data-level') == currentLevel);
            });

            applyFilters();

            const url = new URL(window.location);
            if (currentLevel) {
                url.searchParams.set('level', currentLevel);
            } else {
                url.searchParams.delete('level');
            }
            history.replaceState({}, '', url);

            // Center maps to the rendered features
            // let renderedPoi = map.queryRenderedFeatures({target: {layerId: 'poi-layer'}});
            // Does not work
            // let data = map.queryRenderedFeatures({layers: ['poi-layer']});
            /*console.log('renderedPoi', renderedPoi);
            let bounds = new maplibregl.LngLatBounds();
  
            renderedPoi.forEach(function(feature) {
                console.log(feature.geometry);
                if (feature.type == 'Point') {
                    bounds.extend(feature.geometry.coordinates);
                }
            });
  
            console.log(map);
            console.log(bounds);
            console.log(map.getBearing());
            console.log(map.getPitch());
            map.fitBounds(
                bounds, 
                {
                    padding: 20,
                    bearing: map.getBearing(),
                    pitch: map.getPitch(),
                }
            );*/
        }
    });

    document.querySelector('.interactive-plan__center').addEventListener('click', function () {
        map.flyTo({
            center: initial_center,
            zoom: initial_zoom,
            essential: true
        });
    });

    /*document.querySelector('.interactive-plan__category').addEventListener('click', function(e) {
        const category = e.target?.getAttribute('data-category');
        if (category) {
            currentCategory = category === currentCategory ? null : category;
            document.querySelectorAll('.interactive-plan__category__btn').forEach(button => {
                button.classList.toggle('-active', button.getAttribute('data-category') === currentCategory);
            });
  
            applyFilters();
  
            const url = new URL(window.location);
            if (currentCategory) {
                url.searchParams.set('category', currentCategory);
            } else {
                url.searchParams.delete('category');
            }
            history.replaceState({}, '', url);
        }
    });*/

    function handleCategoryButtonClick(e) {
        const category = e.target?.getAttribute('data-category');
        if (category) {
            currentCategory = category === currentCategory ? null : category;
            document.querySelectorAll('.interactive-plan__category__btn').forEach(button => {
                button.classList.toggle('-active', button.getAttribute('data-category') === currentCategory);
            });

            applyFilters();

            const url = new URL(window.location);
            if (currentCategory) {
                url.searchParams.set('category', currentCategory);
            } else {
                url.searchParams.delete('category');
            }
            history.replaceState({}, '', url);
        }
    }

});
