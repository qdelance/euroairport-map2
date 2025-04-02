import './style.scss';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { Protocol } from "pmtiles";

import { layers, namedFlavor } from '@protomaps/basemaps';

document.addEventListener('DOMContentLoaded', async function () {

    // Position initiale de la carte + emprise maximum autorisée
    // On interdit le zoom trop loin en dehors de l'aéroport
    const initial_center = [7.53, 47.599];
    const initial_zoom = 14;
    const bounds = [[7.46, 47.57], [7.60, 47.63]];

    // Variables globales ci dessous
    let map;

    let poiLoaded = false;
    let pois = [];
    let poiLoadedImages = [];
    let levelGeoJSONloaded = []; // level IDs

    let levels = [];
    let currentLevel = null;

    let categories = [];
    let currentCategory = null;

    let currentPopup = null;

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
            levels = await response.json();
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

    async function loadCategories() {
        try {
            const url = 'json/eap-categories.json';
            let response = await fetch(url);
            if (!response.ok)
                throw new Error(response.statusText);
            categories = await response.json();
            console.log("categories", categories);
        } catch (err) {
            console.error(err);
        }
    }

    async function updateCategorySwitcherControl() {
        const ulElement = document.querySelector('.interactive-plan__category');
        ulElement.innerHTML = "";

        if (currentCategory == null) {

            const rootCategories = categories.filter(c => !c.parent);
            for (const category of rootCategories) {
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
        } else {
            const childCategories = categories.filter(c => c.parent === currentCategory.id);

            let liElement = document.createElement("li");

            let imgElement = document.createElement("img");
            imgElement.src = currentCategory.icon;

            let spanElement = document.createElement("span");
            spanElement.appendChild(imgElement);

            let buttonElement = document.createElement("button");
            let textNode = document.createTextNode(currentCategory.name + ' (retour)');
            buttonElement.classList.add("interactive-plan__category__btn");
            if (currentCategory.parent) {
                buttonElement.dataset.category = currentCategory.parent;
            }
            
            buttonElement.addEventListener('click', handleCategoryButtonClick);
            buttonElement.appendChild(spanElement);
            buttonElement.appendChild(textNode);

            liElement.append(buttonElement);
            ulElement.append(liElement);

            if (childCategories.length > 0) {
                let liElement = document.createElement("li");
                let h3Element = document.createElement("h3");
                let textNode = document.createTextNode('Sous catégories');
                h3Element.appendChild(textNode);
                liElement.append(h3Element);
                ulElement.append(liElement);

                for (const category of childCategories) {
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
            }

            let selectedPOIs = pois.features.filter(poi => poi.properties?.category === currentCategory.id);

            if (selectedPOIs.length > 0) {
                // console.log('QDE, selectedPOIs', selectedPOIs);
                let levelsOfselectedPOI = selectedPOIs.map(poi => {
                    let levelId = poi.properties.level;
                    let level = levels.find(level => level.id === levelId);
                    return level;
                });
                let uniqLevelsOfselectedPOI = levelsOfselectedPOI.filter((value, index, array) => array.indexOf(value) === index);
                let sortedUniqLevelsOfselectedPOI = uniqLevelsOfselectedPOI.sort();
                // console.log('QDE, sortedUniqLevelsOfselectedPOI', sortedUniqLevelsOfselectedPOI);

                let liElement = document.createElement("li");
                let h3Element = document.createElement("h3");
                let textNode = document.createTextNode('Liste des POIs');
                h3Element.appendChild(textNode);
                liElement.append(h3Element);
                ulElement.append(liElement);

                for (let level of sortedUniqLevelsOfselectedPOI) {
                    let liElement = document.createElement("li");
                    let h4Element = document.createElement("h4");
                    let textNode = document.createTextNode(`Etage ${level.name}`);
                    h4Element.appendChild(textNode);
                    liElement.append(h4Element);
                    ulElement.append(liElement);

                    let levelFilteredPOIs = selectedPOIs.filter(poi => poi.properties.level === level.id);
                    let sortedLevelFilteredPOIs = levelFilteredPOIs.sort((a, b) => a.properties.name.toLowerCase().localeCompare(b.properties.name.toLowerCase()));
                    // console.log('QDE, sortedLevelFilteredPOIs', sortedLevelFilteredPOIs);
                    for (const poi of sortedLevelFilteredPOIs) {
                        const poiFID = poi.properties.fid;
                        const poiName = poi.properties.name;
                        const poiLevel = poi.properties.level;
                        if (poi.geometry) {
                            var poiLongitude = poi.geometry.coordinates[0];
                            var poiLatitude = poi.geometry.coordinates[1];
                            let liElement = document.createElement("li");
        
                            let buttonElement = document.createElement("button");
                            textNode = document.createTextNode(`${poiName} => étage ${poiLevel}`);
                            buttonElement.classList.add("interactive-plan__poi__btn");
                            buttonElement.dataset.fid = poiFID;
                            buttonElement.dataset.longitude = poiLongitude;
                            buttonElement.dataset.latitude = poiLatitude;
                            buttonElement.dataset.level = poiLevel;
                            buttonElement.addEventListener('click', handlePOIButtonClick);
                            buttonElement.appendChild(textNode);
        
                            liElement.append(buttonElement);
                            ulElement.append(liElement);
                        } else {
                            // Ca m'est arrivé d'avoir un GeoJSON (corrompu ?) avec une feature
                            // dont la geometry était null
                            console.warn(`Le POI de nom ${poiName} (${poiFID}) n\' pas de géometrie`);
                        }
                    }
                }
            }
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
    await loadCategories();
    updateCategorySwitcherControl();

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

    function hideAllLevels() {
        for (const levelId of levelGeoJSONloaded) {
            // console.log(`On cache le niveau ${levelId}`);
            const layerId = 'eap-layer-level' + levelId;
            map.setLayoutProperty(layerId, 'visibility', 'none');
            map.setLayoutProperty(layerId + '-extrusion', 'visibility', 'none');
        }
    }

    function applyFilters() {

        // Il est possible que le changement de filtre fasse disparaître le POI actif (s'il y en a 1)
        // avec popup visible
        // Dans le doute on ferme la popup pour éviter d'avoir une popup sans POI visible associé
        if (currentPopup) {
            currentPopup.remove();
        }
        
        console.log(`On applique les filtres currentCategory=${currentCategory?.id} currentLevel=${currentLevel?.id}`, currentLevel)
        loadPOIGeoJSON();

        // Ici on gère l'affichage (ou non) de l'étage
        hideAllLevels();
        if (currentLevel != null) {
            console.log(`Affichage de l'étage ${currentLevel.id}`);
            loadLevelGeoJSON(currentLevel)
            const layerId = 'eap-layer-level' + currentLevel.id;
            map.setLayoutProperty(layerId, 'visibility', 'visible');
            map.setLayoutProperty(layerId + '-extrusion', 'visibility', 'visible');
        }

        // Ici on gère l'affichage des POI
        map.setLayoutProperty('eap-layer-poi', 'visibility', 'visible');
        if (currentCategory != null && currentLevel == null) {
            console.log(`Filtrage des POI par la catégorie ${currentCategory.id}`);
            map.setFilter('eap-layer-poi', ['==', 'category', currentCategory.id]);
        } else if (currentCategory == null && currentLevel != null) {
            console.log(`Filtrage des POI par l'étage ${currentLevel.id}`);
            map.setFilter('eap-layer-poi', ['==', 'level', currentLevel.id]);
        } else if (currentCategory != null && currentLevel != null) {
            console.log(`Filtrage des POI par l'étage ${currentLevel.id} et la catégorie ${currentCategory.id}`);
            map.setFilter('eap-layer-poi', [
                "all",
                ['==', 'level', currentLevel.id],
                ['==', 'category', currentCategory.id]
            ]
            );
        } else {
            console.log(`Pas de filtrage des POI`);
            map.setFilter('eap-layer-poi', null);
        }
    }

    // Chargement d'un GeoJSON décrivant l'étage sélectionné
    async function loadLevelGeoJSON(level) {
        const levelId = level.id;
        const url = level.geojson;
        console.log(`loadLevelGeoJSON, level=${levelId} url=${url}`);

        if (!levelGeoJSONloaded.includes(levelId)) {
            levelGeoJSONloaded.push(levelId);
            try {
                let response = await fetch(url);
                if (!response.ok)
                    throw new Error(response.statusText);

                let data = await response.json();
                // console.log("data", data);

                const sourceId = 'eap-source-level' + levelId;
                const layerId = 'eap-layer-level' + levelId;
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
            } catch (err) {
                console.error(err);
            }
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
                // console.log("pois", pois);

                for (const poi of pois.features) {
                    console.log(`Traitement du POI ${poi.properties.name} de catégorie ${poi.properties.category}`);
                    const imageId = 'eap-' + poi.properties.category;

                    // Cherche l'icône associée au POI à partir de sa catégorie
                    // TODO en fait plutôt que de charger les icônes en bouclant sur les POI
                    // et de devoir gérer des doublons (N POIs pour 1 même catégories)
                    // il vaudrait mieux charger les icônes après chargement des catégories
                    // Ensuite ci dessous, une optimisation serait de ne mettre dans la couche "symbol"
                    // de Maplibre que les POIs dont la catégorie (et l'icône) a été précédemment chargée
                    // Note : en vrai avec Drupal, le pb ne devrait pas se poser car les POI
                    // seront toujours dans une catégorie avec icône (normalement) 
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

                    // TODO si on clique sur la carte à haut niveau de zoom
                    // on peut en fait cliquer sur plusieurs features/POI d'un coup
                    // donc on pourrait vouloir mettre ces X features dans la même popup
                    // Pour le moment je ne prends que la première

                    const coordinates = e.features[0].geometry.coordinates.slice();
                    map.flyTo({
                        center: coordinates,
                        zoom: 17,
                        essential: true
                    });

                    if (currentPopup) {
                        currentPopup.remove();
                    }
                    currentPopup = new maplibregl.Popup()
                        .setLngLat(coordinates)
                        .setHTML(getPopupContentFromFeature(e.features[0]));
                    currentPopup.addTo(map);

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
        let levelId = e.target?.getAttribute('data-level');
        // level = parseInt(level, 10);
        if (levelId != null) {
            /*currentLevel = level === currentLevel ? null : level;
            document.querySelectorAll('.interactive-plan__level__btn').forEach(button => {
                button.classList.toggle('-active', button.getAttribute('data-level') == currentLevel);
            });*/
            currentLevel = levels.find(l => l.id == levelId);
            // console.log('QDE, click level levels', levels);
            // console.log('QDE, click level currentLevel', currentLevel);
            applyFilters();

            const url = new URL(window.location);
            if (currentLevel) {
                url.searchParams.set('level', currentLevel.id);
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

    function handleCategoryButtonClick(e) {
        const categoryId = e.target?.getAttribute('data-category');
        console.log('QDE, handleCategoryButtonClick categoryId', categoryId)
        if (categoryId) {
            currentCategory = categories.find(c => c.id === categoryId)
            console.log('QDE, handleCategoryButtonClick e', e)
            console.log('QDE, handleCategoryButtonClick currentCategory', currentCategory)
            if (currentCategory) {
                /*currentCategory = category === currentCategory ? null : category;
                document.querySelectorAll('.interactive-plan__category__btn').forEach(button => {
                    button.classList.toggle('-active', button.getAttribute('data-category') === currentCategory);
                });*/



                /*const url = new URL(window.location);
                if (currentCategory) {
                    url.searchParams.set('category', currentCategory);
                } else {
                    url.searchParams.delete('category');
                }
                history.replaceState({}, '', url);*/
            } else {
                console.log('QDE, handleCategoryButtonClick, pas de categorie', e)
            }
        } else {
            currentCategory = null;
            currentLevel = null;
        }
        applyFilters();
        updateCategorySwitcherControl();
    }

    function handlePOIButtonClick(e) {
        const fid = e.target?.getAttribute('data-fid');
        // const longitude = e.target?.getAttribute('data-latitude');
        // const latitude = e.target?.getAttribute('data-latitude');
        const levelId = e.target?.getAttribute('data-level');
        currentLevel = levels.find(l => l.id == levelId);
        console.log('QDE, handlePOIButtonClick levels', levels);
        console.log('QDE, handlePOIButtonClick currentLevel', currentLevel);
        applyFilters();

        // Attention on peut avoir des doublons
        // https://github.com/mapbox/mapbox-gl-js/issues/3147#issuecomment-244844915
        const selectedPOIs = map.querySourceFeatures('eap-source-poi', {
            filter: ['==', ["get", "fid"], ["to-number", fid]]
        });

        const poi = pois.features.find(poi => poi.properties.fid == fid)
        map.flyTo({
            center: poi.geometry.coordinates,
            zoom: 17,
            essential: true
        });

        if (currentPopup) {
            currentPopup.remove();
        }
        currentPopup = new maplibregl.Popup()
            .setLngLat(poi.geometry.coordinates)
            .setHTML(getPopupContentFromFeature(poi));
        currentPopup.addTo(map);
    }

    function getPopupContentFromFeature(f) {
        const name = f.properties.name;
        const level = f.properties.level;
        const description = f.properties.description;


        let popupContent = `<h3>${name}</h3><p><strong>Etage : ${level}</strong></p>`;
        if (description) {
            popupContent += `<p>${description}</p>`
        } else {
            popupContent += '<p>Pas de description</p>'
        }

        return popupContent;
    }

});
