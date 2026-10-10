import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useStore } from '../state/useStore.js';
import { useCommunityReportsStore } from '../state/useCommunityReportsStore.js';
import { isOpenAt } from '../lib/lifeline.js';
import { fetchLifelinePOIs } from '../lib/overpass.js';
import { DEFAULT_CONFIG } from '../../../shared/scoringConfig.js';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapCanvas({ origin, destination, routes = [], activeRouteId }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const originMarker = useRef(null);
  const destMarker = useRef(null);
  
  const showZones = useStore(state => state.showZones);
  const showRefuges = useStore(state => state.showRefuges);
  const [routeSourcesReady, setRouteSourcesReady] = useState(false);
  const refuges = useStore(state => state.refuges);
  const travelTime = useStore(state => state.travelTime);
  const currentLifelinePos = useStore(state => state.currentLifelinePos);
  const overlayRefuges = useStore(state => state.overlayRefuges);
  const overlayFilters = useStore(state => state.overlayFilters);
  const setOverlayFilter = useStore(state => state.setOverlayFilter);
  const addOverlayRefuges = useStore(state => state.addOverlayRefuges);
  
  const fetchTimeoutRef = useRef(null);
  
  const currentLocation = useStore(state => state.currentLocation);
  const isNavigating = useStore(state => state.isNavigating);
  const isFollowing = useStore(state => state.isFollowing);
  const mapStyle = useStore(state => state.mapStyle);
  const showTraffic = useStore(state => state.showTraffic);
  const showTerrain = useStore(state => state.showTerrain);
  const showTransit = useStore(state => state.showTransit);
  const isMeasuring = useStore(state => state.isMeasuring);
  const measurementPoints = useStore(state => state.measurementPoints);
  const addMeasurementPoint = useStore(state => state.addMeasurementPoint);


  const { reports, setSelectedReportId, isCreatingReport, reportCreationLocation, setReportCreationLocation, fetchReports } = useCommunityReportsStore();
  const reportCreationMarker = useRef(null);
  const currentLocationMarker = useRef(null);
  
  const [pulseActive, setPulseActive] = useState(false);
  const [mistTheme, setMistTheme] = useState('theme-green');

  // Fetch reports on mount
  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (map.current) return; // initialize map only once
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: useStore.getState().mapStyle || 'mapbox://styles/mapbox/dark-v11',
      center: [77.5946, 12.9716], // Bengaluru
      zoom: 11,
    });

    const handleFlyTo = (e) => {
      const { coords, zoom } = e.detail;
      if (map.current) {
        map.current.flyTo({
          center: coords,
          zoom: zoom || 16,
          essential: true
        });
      }
    };
    window.addEventListener('flyToLocation', handleFlyTo);

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('dragstart', () => {
      if (useStore.getState().isNavigating) {
        useStore.getState().setIsFollowing(false);
      }
    });

    let listenersAdded = false;
    map.current.on('style.load', async () => {
      // Load zones
      try {
        const res = await fetch('/zones.bengaluru.geojson');
        const zonesData = await res.json();
        
        map.current.addSource('zones', {
          type: 'geojson',
          data: zonesData,
        });

        // Add zone fill layer
        map.current.addLayer({
          id: 'zones-fill',
          type: 'fill',
          source: 'zones',
          paint: {
            'fill-color': [
              'match',
              ['get', 'risk'],
              'red', '#ef4444',
              'yellow', '#eab308',
              'green', '#22c55e',
              '#888'
            ],
            'fill-opacity': 0.3,
          },
        });

        // Add zone outline layer
        map.current.addLayer({
          id: 'zones-outline',
          type: 'line',
          source: 'zones',
          paint: {
            'line-color': [
              'match',
              ['get', 'risk'],
              'red', '#ef4444',
              'yellow', '#eab308',
              'green', '#22c55e',
              '#888'
            ],
            'line-width': 1,
          },
        });
        
        // Add click event for popups
        map.current.on('click', 'zones-fill', (e) => {
          if (!e.features.length) return;
          const feature = e.features[0];
          const { name, risk, note } = feature.properties;
          
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="color: black; padding: 4px;">
                <strong>${name}</strong><br/>
                <span style="font-size: 0.875rem; text-transform: capitalize; color: #4b5563;">Risk: ${risk}</span><br/>
                <span style="font-size: 0.75rem; color: #6b7280;">${note}</span>
              </div>
            `)
            .addTo(map.current);
        });
        
        // Change cursor
        map.current.on('mouseenter', 'zones-fill', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'zones-fill', () => {
          map.current.getCanvas().style.cursor = '';
        });

      } catch (err) {
        console.error('Failed to load risk zones:', err);
      }
      
      // Add empty route source
      map.current.addSource('routes-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      
      // Inactive routes layer
      map.current.addLayer({
        id: 'routes-inactive',
        type: 'line',
        source: 'routes-source',
        filter: ['!=', ['get', 'id'], ''],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#6b7280',
          'line-width': 3,
          'line-opacity': 0.5,
          'line-opacity-transition': { duration: 300 },
          'line-color-transition': { duration: 300 }
        }
      });
      
      // Hitbox for inactive routes
      map.current.addLayer({
        id: 'routes-inactive-hitbox',
        type: 'line',
        source: 'routes-source',
        filter: ['!=', ['get', 'id'], ''],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': 'transparent',
          'line-width': 20
        }
      });
      
      // Active route layer casing
      map.current.addLayer({
        id: 'routes-active-casing',
        type: 'line',
        source: 'routes-source',
        filter: ['==', ['get', 'id'], ''],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#1f2937',
          'line-width': 8,
          'line-opacity-transition': { duration: 300 }
        }
      });
      
      // Active route layer
      map.current.addLayer({
        id: 'routes-active',
        type: 'line',
        source: 'routes-source',
        filter: ['==', ['get', 'id'], ''],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#4ade80',
          'line-width': 5,
          'line-opacity-transition': { duration: 300 },
          'line-color-transition': { duration: 300 }
        }
      });
      
      // Draw risky segments for active route
      map.current.addSource('segments-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      
      map.current.addLayer({
        id: 'segments-active',
        type: 'line',
        source: 'segments-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'risk'],
            'red', '#ef4444',
            'yellow', '#eab308',
            'green', '#22c55e',
            '#4ade80'
          ],
          'line-width': 5,
          'line-opacity-transition': { duration: 300 },
          'line-color-transition': { duration: 300 }
        }
      });

      setRouteSourcesReady(true);


      // Lifeline layers
      if (!map.current.getSource('lifeline-reach')) {
        map.current.addSource('lifeline-reach', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }
      
      if (!map.current.getLayer('lifeline-reach-layer')) {
        map.current.addLayer({
          id: 'lifeline-reach-layer',
          type: 'fill',
          source: 'lifeline-reach',
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.1,
            'fill-outline-color': '#3b82f6'
          }
        });
      }
      
      if (!map.current.getSource('lifeline-link')) {
        map.current.addSource('lifeline-link', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.current.getLayer('lifeline-link-layer')) {
        map.current.addLayer({
          id: 'lifeline-link-layer',
          type: 'line',
          source: 'lifeline-link',
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 2,
            'line-opacity': 0.8,
            'line-dasharray': [2, 2]
          }
        });
      }

      if (!map.current.getSource('lifeline-refuges')) {
        map.current.addSource('lifeline-refuges', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.current.getLayer('lifeline-refuges-bg')) {
        map.current.addLayer({
          id: 'lifeline-refuges-bg',
          type: 'circle',
          source: 'lifeline-refuges',
          paint: {
            'circle-radius': 12,
            'circle-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-stroke-color': [
              'match',
              ['get', 'type'],
              'hospital', '#ef4444',
              'pharmacy', '#10b981',
              'police', '#3b82f6',
              'petrol', '#f59e0b',
              '#9ca3af'
            ]
          }
        });
      }

      if (!map.current.getLayer('lifeline-refuges-icon')) {
        map.current.addLayer({
          id: 'lifeline-refuges-icon',
          type: 'symbol',
          source: 'lifeline-refuges',
          layout: {
            'text-field': [
              'match',
              ['get', 'type'],
              'hospital', '✚',
              'pharmacy', '✚',
              'police', '★',
              'petrol', '⛽',
              '•'
            ],
            'text-size': 14,
            'text-allow-overlap': true
          },
          paint: {
            'text-color': [
              'match',
              ['get', 'type'],
              'hospital', '#ef4444',
              'pharmacy', '#10b981',
              'police', '#3b82f6',
              'petrol', '#f59e0b',
              '#9ca3af'
            ]
          }
        });
      }
      
      // Community Reports Layer
      if (!map.current.getSource('community-reports')) {
        map.current.addSource('community-reports', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50
        });
      }

      if (!map.current.getLayer('community-reports-clusters')) {
        map.current.addLayer({
          id: 'community-reports-clusters',
          type: 'circle',
          source: 'community-reports',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#f97316',
            'circle-radius': 18,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }
        });

        map.current.addLayer({
          id: 'community-reports-cluster-count',
          type: 'symbol',
          source: 'community-reports',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
          },
          paint: {
            'text-color': '#ffffff'
          }
        });
      }

      if (!map.current.getLayer('community-reports-layer')) {
        map.current.addLayer({
          id: 'community-reports-layer',
          type: 'circle',
          source: 'community-reports',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': 8,
            'circle-color': [
              'match',
              ['get', 'status'],
              'MODERATOR_VERIFIED', '#3b82f6',
              'COMMUNITY_VERIFIED', '#22c55e',
              'DISPUTED', '#ef4444',
              '#eab308' // PENDING/DEFAULT
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });
      }

      if (!listenersAdded) {
        listenersAdded = true;

      // Map click handler (global)  
        map.current.on('click', (e) => {
          const isCreating = useCommunityReportsStore.getState().isCreatingReport;
          if (isCreating) {
            useCommunityReportsStore.getState().setReportCreationLocation([e.lngLat.lng, e.lngLat.lat]);
          }
        });
        
        // Popup logic
        map.current.on('click', 'lifeline-refuges-icon', (e) => {
          if (!e.features.length) return;
          const feature = e.features[0];
          const { name, type, openFrom, openTo, source, address, phone, opening_hours } = feature.properties;
          
          let hours = 'Unknown';
          if (opening_hours) {
            hours = opening_hours;
          } else if (openFrom !== undefined && openTo !== undefined) {
            if (openFrom === 0 && openTo === 24) hours = '24 Hours';
            else hours = `${openFrom}:00 - ${openTo}:00`;
          }
          
          const addressLine = address ? `<span style="font-size: 0.875rem; color: #4b5563;">${address}</span><br/>` : '';
          const phoneLine = phone ? `<span style="font-size: 0.875rem; color: #4b5563;">📞 ${phone}</span><br/>` : '';
          const distLine = feature.properties.distance ? `<span style="font-size: 0.875rem; color: #4b5563;">Distance: ${parseFloat(feature.properties.distance).toFixed(1)} km</span><br/>` : '';
          
          const coords = feature.geometry.coordinates;
          const dirLink = `<a href="https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}" target="_blank" style="color: #3b82f6; font-size: 0.875rem; font-weight: bold; text-decoration: underline; display: inline-block; margin-top: 4px;">Get Directions</a>`;
  
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="color: black; padding: 4px;">
                <strong>${name}</strong><br/>
                <span style="font-size: 0.875rem; text-transform: capitalize; color: #4b5563;">Type: ${type}</span><br/>
                ${distLine}
                ${addressLine}
                ${phoneLine}
                <span style="font-size: 0.875rem; color: #4b5563;">Hours: ${hours}</span><br/>
                <span style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase;">Source: ${source || 'Unknown'}</span><br/>
                ${dirLink}
              </div>
            `)
            .addTo(map.current);
        });
        
        // Community reports click handler
        map.current.on('click', 'community-reports-layer', (e) => {
          if (!e.features.length) return;
          const feature = e.features[0];
          
          // Block if we're picking a location
          const isCreating = useCommunityReportsStore.getState().isCreatingReport;
          if (isCreating) return;
  
          // Prevent global map click
          e.originalEvent.stopPropagation();
          
          const id = feature.properties.id;
          useCommunityReportsStore.getState().setSelectedReportId(id);
        });
        
        // Inactive routes click handler
        map.current.on('click', 'routes-inactive-hitbox', (e) => {
          if (!e.features.length) return;
          e.originalEvent.stopPropagation();
          const routeId = e.features[0].properties.id;
          useStore.getState().setActiveRouteId(routeId);
        });
        
        map.current.on('mouseenter', 'routes-inactive-hitbox', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'routes-inactive-hitbox', () => {
          map.current.getCanvas().style.cursor = '';
        });
        
        map.current.on('mouseenter', 'community-reports-layer', () => {
          if (!useCommunityReportsStore.getState().isCreatingReport) {
            map.current.getCanvas().style.cursor = 'pointer';
          }
        });
        map.current.on('mouseleave', 'community-reports-layer', () => {
          map.current.getCanvas().style.cursor = '';
        });
  
        map.current.on('mouseenter', 'lifeline-refuges-icon', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'lifeline-refuges-icon', () => {
          map.current.getCanvas().style.cursor = '';
        });
  
        }
    });

    return () => {
      window.removeEventListener('flyToLocation', handleFlyTo);
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);




  // Handle Measurement tool clicks
  useEffect(() => {
    if (!map.current) return;
    
    const clickHandler = (e) => {
      if (!useStore.getState().isMeasuring) return;
      useStore.getState().addMeasurementPoint([e.lngLat.lng, e.lngLat.lat]);
    };
    
    map.current.on('click', clickHandler);
    return () => {
      if (map.current) map.current.off('click', clickHandler);
    };
  }, []);

  // Render Measurement line
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    
    if (!map.current.getSource('measurement')) {
      map.current.addSource('measurement', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.current.addLayer({
        id: 'measurement-line',
        type: 'line',
        source: 'measurement',
        paint: {
          'line-color': '#0ea5e9',
          'line-width': 4,
          'line-dasharray': [2, 2]
        }
      });
      map.current.addLayer({
        id: 'measurement-points',
        type: 'circle',
        source: 'measurement',
        paint: {
          'circle-radius': 6,
          'circle-color': '#ffffff',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#0ea5e9'
        }
      });
    }
    
    const source = map.current.getSource('measurement');
    if (source) {
      if (measurementPoints.length > 0) {
        const line = measurementPoints.length > 1 ? turf.lineString(measurementPoints) : null;
        const points = measurementPoints.map(pt => turf.point(pt));
        const features = [...points];
        if (line) features.push(line);
        source.setData(turf.featureCollection(features));
      } else {
        source.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }, [measurementPoints, mapStyle]);

  // Handle traffic and terrain overlays
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    
    // Traffic
    if (showTraffic) {
      if (!map.current.getSource('mapbox-traffic')) {
        map.current.addSource('mapbox-traffic', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-traffic-v1'
        });
      }
      if (!map.current.getLayer('traffic-layer')) {
        map.current.addLayer({
          id: 'traffic-layer',
          type: 'line',
          source: 'mapbox-traffic',
          'source-layer': 'traffic',
          paint: {
            'line-color': [
              'match',
              ['get', 'congestion'],
              'low', '#22c55e',
              'moderate', '#eab308',
              'heavy', '#ef4444',
              'severe', '#991b1b',
              '#ffffff'
            ],
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 6]
          }
        });
      }
      map.current.setLayoutProperty('traffic-layer', 'visibility', 'visible');
    } else {
      if (map.current.getLayer('traffic-layer')) {
        map.current.setLayoutProperty('traffic-layer', 'visibility', 'none');
      }
    }
    
    // Terrain
    if (showTerrain) {
      if (!map.current.getSource('mapbox-dem')) {
        map.current.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
      }
      map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    } else {
      map.current.setTerrain(null);
    }

    // Transit
    if (showTransit) {
      if (!map.current.getSource('transit-source')) {
        map.current.addSource('transit-source', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-streets-v8'
        });
      }
      if (!map.current.getLayer('transit-major')) {
        map.current.addLayer({
          id: 'transit-major',
          type: 'line',
          source: 'transit-source',
          'source-layer': 'road',
          filter: [
            'any',
            ['==', ['get', 'class'], 'major_rail'],
            ['==', ['get', 'class'], 'minor_rail']
          ],
          paint: {
            'line-color': [
              'match',
              ['get', 'class'],
              'major_rail', '#3b82f6', // Blue for subways/trains
              'minor_rail', '#ec4899', // Pink for trams/light rail
              '#8b5cf6'
            ],
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 4],
            'line-opacity': 0.8
          }
        });
      }
      map.current.setLayoutProperty('transit-major', 'visibility', 'visible');
    } else {
      if (map.current.getLayer('transit-major')) {
        map.current.setLayoutProperty('transit-major', 'visibility', 'none');
      }
    }
    
  }, [showTraffic, showTerrain, showTransit, mapStyle]); // mapStyle re-triggers because sources might be dropped

  const currentStyleRef = useRef(useStore.getState().mapStyle || 'mapbox://styles/mapbox/dark-v11');

  // Handle map style changes
  useEffect(() => {
    if (!map.current) return;
    if (currentStyleRef.current !== mapStyle) {
      currentStyleRef.current = mapStyle;
      
      const isSatellite = mapStyle.includes('satellite');
      setMistTheme(isSatellite ? 'theme-green' : 'theme-dark');
      
      setPulseActive(true);
      
      // Delay style set to 750ms so it happens behind the thickest part of the mist
      setTimeout(() => {
        map.current.setStyle(mapStyle);
      }, 750);
      
      setTimeout(() => {
        setPulseActive(false);
      }, 1500);
    }
  }, [mapStyle]);

  // Update GPS current location marker
  useEffect(() => {
    if (!map.current) return;
    
    if (isNavigating && currentLocation) {
      if (!currentLocationMarker.current) {
        const el = document.createElement('div');
        el.className = 'w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] relative flex justify-center items-center';
        
        // Add a pulse ring
        const pulse = document.createElement('div');
        pulse.className = 'absolute w-12 h-12 bg-blue-500 rounded-full opacity-30 animate-ping';
        el.appendChild(pulse);
        
        // Add a small inner dot
        const inner = document.createElement('div');
        inner.className = 'w-1.5 h-1.5 bg-white rounded-full';
        el.appendChild(inner);

        currentLocationMarker.current = new mapboxgl.Marker({ element: el, pitchAlignment: 'map' })
          .setLngLat(currentLocation)
          .addTo(map.current);
      } else {
        currentLocationMarker.current.setLngLat(currentLocation);
      }

      // Camera follow logic
      if (isFollowing) {
        map.current.flyTo({
          center: currentLocation,
          zoom: Math.max(map.current.getZoom(), 15),
          speed: 1.2,
          curve: 1,
          easing(t) { return t; }
        });
      }
    } else if (!isNavigating && currentLocationMarker.current) {
      currentLocationMarker.current.remove();
      currentLocationMarker.current = null;
    }
  }, [currentLocation, isNavigating, isFollowing]);

  // Update origin/destination markers
  useEffect(() => {
    if (!map.current) return;
    
    if (origin) {
      if (!originMarker.current) {
        const el = document.createElement('div');
        el.className = 'w-5 h-5 bg-green-500 rounded-full border-[3px] border-white shadow-[0_0_10px_rgba(34,197,94,0.8)] flex items-center justify-center after:content-[""] after:w-1.5 after:h-1.5 after:bg-white after:rounded-full';
        originMarker.current = new mapboxgl.Marker(el).setLngLat(origin).addTo(map.current);
      } else {
        originMarker.current.setLngLat(origin);
      }
    } else if (originMarker.current) {
      originMarker.current.remove();
      originMarker.current = null;
    }
    
    if (destination) {
      if (!destMarker.current) {
        const el = document.createElement('div');
        el.className = 'w-5 h-5 bg-black rounded-full border-[3px] border-white shadow-[0_0_10px_rgba(255,255,255,0.5)] flex items-center justify-center after:content-[""] after:w-1.5 after:h-1.5 after:bg-white after:rounded-full';
        destMarker.current = new mapboxgl.Marker(el).setLngLat(destination).addTo(map.current);
      } else {
        destMarker.current.setLngLat(destination);
      }
    } else if (destMarker.current) {
      destMarker.current.remove();
      destMarker.current = null;
    }
  }, [origin, destination]);

  // Update report creation marker
  useEffect(() => {
    if (!map.current) return;

    if (isCreatingReport && reportCreationLocation) {
      if (!reportCreationMarker.current) {
        const el = document.createElement('div');
        el.className = 'w-6 h-6 bg-blue-500 rounded-full border-[3px] border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] flex items-center justify-center';
        el.innerHTML = '<span class="text-white text-xs font-bold leading-none">!</span>';
        reportCreationMarker.current = new mapboxgl.Marker(el, { draggable: true })
          .setLngLat(reportCreationLocation)
          .addTo(map.current);
        
        reportCreationMarker.current.on('dragend', () => {
          const lngLat = reportCreationMarker.current.getLngLat();
          setReportCreationLocation([lngLat.lng, lngLat.lat]);
        });
      } else {
        reportCreationMarker.current.setLngLat(reportCreationLocation);
      }
    } else {
      if (reportCreationMarker.current) {
        reportCreationMarker.current.remove();
        reportCreationMarker.current = null;
      }
    }
  }, [isCreatingReport, reportCreationLocation, setReportCreationLocation]);

  // Update reports source
  // Update routes-source when routes change
  useEffect(() => {
    if (!map.current || !routeSourcesReady) return;
    
    const source = map.current.getSource('routes-source');
    if (source) {
      const features = routes.map(r => {
        return turf.lineString(r.geometry.coordinates, { id: r.id, label: r.label });
      });
      source.setData(turf.featureCollection(features));
      
      if (features.length > 0) {
        try {
          const bbox = turf.bbox(turf.featureCollection(features));
          map.current.fitBounds(bbox, { padding: 50 });
        } catch(e) { console.error('Failed to fit bounds', e); }
      }
    }
  }, [routes, routeSourcesReady]);

  // Update active route styles and segments when activeRouteId changes
  useEffect(() => {
    if (!map.current || !routeSourcesReady) return;
    
    const segmentsSource = map.current.getSource('segments-source');
    if (segmentsSource) {
      const activeRoute = routes.find(r => r.id === activeRouteId);
      if (activeRoute && activeRoute.segments) {
        segmentsSource.setData(activeRoute.segments);
      } else {
        segmentsSource.setData({ type: 'FeatureCollection', features: [] });
      }
      map.current.setLayoutProperty('routes-active', 'visibility', 'visible');
    }
    
    // Update active route filter
    if (map.current.getLayer('routes-inactive')) {
      map.current.setFilter('routes-inactive', ['!=', ['get', 'id'], activeRouteId || '']);
      map.current.setFilter('routes-inactive-hitbox', ['!=', ['get', 'id'], activeRouteId || '']);
      map.current.setFilter('routes-active-casing', ['==', ['get', 'id'], activeRouteId || '']);
      map.current.setFilter('routes-active', ['==', ['get', 'id'], activeRouteId || '']);
    }
    
  }, [routes, activeRouteId, routeSourcesReady]);

  // Update Community Reports geojson source
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    
    const source = map.current.getSource('community-reports');
    if (source) {
      // Filter out rejected and expired reports as requested in requirements
      const activeReports = reports.filter(r => 
        r.status !== 'REJECTED' && r.status !== 'EXPIRED'
      );

      const features = activeReports.map(r => {
        const coords = r.location?.coordinates || r.location; // Fallback if old data
        return turf.point(coords, {
          id: r.id,
          status: r.status,
          category: r.category
        });
      });
      source.setData(turf.featureCollection(features));
    }
  }, [reports]);

  // Toggle zones
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    
    const visibility = showZones ? 'visible' : 'none';
    if (map.current.getLayer('zones-fill')) {
      map.current.setLayoutProperty('zones-fill', 'visibility', visibility);
      map.current.setLayoutProperty('zones-outline', 'visibility', visibility);
    }
  }, [showZones]);


  // Update refuges points
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const source = map.current.getSource('lifeline-refuges');
    if (source) {
      const routePois = refuges?.features || [];
      const combined = [];
      
      for (const poi of routePois) {
        const type = poi.properties ? poi.properties.type : poi.type;
        if (overlayFilters && overlayFilters[type] === false) continue; // Skip if filtered out
        
        if (poi.type === 'Feature') combined.push(poi);
        else combined.push(turf.point(poi.coords, poi));
      }
      
      const hour = travelTime.getHours();
      const openRefuges = combined.filter(r => isOpenAt(r, hour));
      
      source.setData(turf.featureCollection(openRefuges));
    }
  }, [refuges, overlayFilters, travelTime]);

  // Update lifeline reach and link
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const linkSource = map.current.getSource('lifeline-link');
    const reachSource = map.current.getSource('lifeline-reach');
    
    if (linkSource && reachSource) {
      if (currentLifelinePos && refuges?.features) {
        const hour = travelTime.getHours();
        const openRefuges = refuges.features.filter(r => isOpenAt(r, hour));
        
        let nearest = null;
        let minDist = Infinity;
        const currentPt = turf.point(currentLifelinePos);
        
        for (const r of openRefuges) {
          const dist = turf.distance(currentPt, r, { units: 'kilometers' });
          if (dist < minDist) {
            minDist = dist;
            nearest = r;
          }
        }
        
        if (nearest) {
          linkSource.setData(turf.featureCollection([
            turf.lineString([currentLifelinePos, nearest.geometry.coordinates])
          ]));
        } else {
          linkSource.setData(turf.featureCollection([]));
        }
        
        const circle = turf.circle(currentLifelinePos, DEFAULT_CONFIG.lifeline.refugeRadiusKm, { units: 'kilometers', steps: 64 });
        reachSource.setData(turf.featureCollection([circle]));
      } else {
        linkSource.setData(turf.featureCollection([]));
        reachSource.setData(turf.featureCollection([]));
      }
    }
  }, [currentLifelinePos, refuges, travelTime]);

  // Toggle refuges
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const visibility = showRefuges ? 'visible' : 'none';

    if (map.current.getLayer('lifeline-refuges-bg')) {
      map.current.setLayoutProperty('lifeline-refuges-bg', 'visibility', visibility);
    }
    if (map.current.getLayer('lifeline-refuges-icon')) {
      map.current.setLayoutProperty('lifeline-refuges-icon', 'visibility', visibility);
    }
    if (map.current.getLayer('lifeline-link-layer')) {
      map.current.setLayoutProperty('lifeline-link-layer', 'visibility', visibility);
    }
    if (map.current.getLayer('lifeline-reach-layer')) {
      map.current.setLayoutProperty('lifeline-reach-layer', 'visibility', visibility);
    }
  }, [showRefuges]);

  return (
    <div className="relative flex-1 w-full h-full min-h-[400px] overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      
      {/* Transition Mist & Leaves */}
      {pulseActive && (
        <>
          <div className={`mist-element active ${mistTheme}`}></div>
          {mistTheme === 'theme-green' && (
            <div className="absolute inset-0 overflow-hidden z-[1001] pointer-events-none">
              {[...Array(60)].map((_, i) => (
                <div 
                  key={i} 
                  className="leaf" 
                  style={{
                    top: `${Math.random() * 90}%`,
                    animationDelay: `${Math.random() * 0.4}s`,
                    animationDuration: `${1.2 + Math.random() * 0.6}s`,
                    '--leaf-scale': 0.6 + Math.random() * 1.5,
                    '--leaf-y': `${-100 + Math.random() * 300}px`,
                    '--leaf-rot': `${360 + Math.random() * 720}deg`
                  }}
                ></div>
              ))}
            </div>
          )}
        </>
      )}
      
      {/* Map Controls */}
      <div className="absolute top-6 left-6 flex flex-col gap-4 z-10 w-64 hidden md:flex">
        {/* We moved Risk Zones and Lifelines to the sidebar. 
            If you want them back as map overlays on desktop only, you can place them here. 
            Currently removed to maximize map visibility as requested. */}
      </div>
    </div>
  );
}
