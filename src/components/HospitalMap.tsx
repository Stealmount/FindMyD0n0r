import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Navigation } from 'lucide-react';

// Lucide inline SVG strings (technically valid for L.divIcon `html`).
// Leaflet accepts plain HTML strings here — NEVER pass a React element.
const MAP_PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';

const NAV_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>';

interface HospitalMapProps {
 hospitalLat: number;
 hospitalLng: number;
 hospitalName: string;
 donorLat?: number;
 donorLng?: number;
 distanceKm?: number;
}

export default function HospitalMap({
 hospitalLat,
 hospitalLng,
 hospitalName,
 donorLat,
 donorLng,
 distanceKm,
}: HospitalMapProps) {
 const mapContainerRef = useRef<HTMLDivElement>(null);
 const mapRef = useRef<L.Map | null>(null);

 useEffect(() => {
 // 1. Inject Leaflet CSS if not already present
 const cssId = 'leaflet-css-link';
 if (!document.getElementById(cssId)) {
 const link = document.createElement('link');
 link.id = cssId;
 link.rel = 'stylesheet';
 link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
 document.head.appendChild(link);
 }

 if (!mapContainerRef.current) return;

 // Clean up existing map instance if present to avoid "Map container is already initialized"
 if (mapRef.current) {
 mapRef.current.remove();
 mapRef.current = null;
 }
 if ((mapContainerRef.current as any)._leaflet_id) {
 (mapContainerRef.current as any)._leaflet_id = null;
 }

 // 2. Initialize Map
 const centerLat = donorLat ? (hospitalLat + donorLat) / 2 : hospitalLat;
 const centerLng = donorLng ? (hospitalLng + donorLng) / 2 : hospitalLng;
 const zoomLevel = donorLat ? 12 : 14;

 const map = L.map(mapContainerRef.current, {
 center: [centerLat, centerLng],
 zoom: zoomLevel,
 zoomControl: true,
 attributionControl: false,
 });

 mapRef.current = map;

 // 3. Add OpenStreetMap Tiles (Delivery-app style sleek grey/warm style)
 L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
 maxZoom: 19,
 }).addTo(map);

 // 4. Custom Marker Icons to avoid Leaflet's default image loading bugs in webpack/vite
  const hospitalIcon = L.divIcon({
  html: `
  <div class="relative flex items-center justify-center">
  <span class="animate-ping absolute inline-flex h-9 w-9 rounded-full bg-blood-400 opacity-75"></span>
  <div class="relative bg-blood-600 border-2 border-white rounded-full p-2 text-white flex items-center justify-center w-8 h-8">
  ${MAP_PIN_SVG}
  </div>
  </div>
  `,
  className: 'custom-div-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  });

  const donorIcon = L.divIcon({
  html: `
  <div class="relative flex items-center justify-center">
  <div class="relative bg-blue-600 border-2 border-white rounded-full p-2 text-white flex items-center justify-center w-8 h-8">
  ${NAV_SVG}
  </div>
  </div>
  `,
  className: 'custom-div-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  });

 // 5. Add markers
 L.marker([hospitalLat, hospitalLng], { icon: hospitalIcon })
 .addTo(map)
 .bindPopup(`<b>${hospitalName}</b><br/>Hospital Destination`)
 .openPopup();

 if (donorLat && donorLng) {
 L.marker([donorLat, donorLng], { icon: donorIcon })
 .addTo(map)
 .bindPopup('<b>Your Registered Area</b><br/>Approximate Start Point');

 // Draw route indicator line
 L.polyline([[donorLat, donorLng], [hospitalLat, hospitalLng]], {
  color: '#C8102E',
 weight: 3,
 dashArray: '5, 8',
 opacity: 0.8,
 }).addTo(map);

 // Fit bounds to show both
 const bounds = L.latLngBounds([[donorLat, donorLng], [hospitalLat, hospitalLng]]);
 map.fitBounds(bounds, { padding: [30, 30] });
 }

 // Cleanup on unmount
 return () => {
 if (mapRef.current) {
 mapRef.current.remove();
 mapRef.current = null;
 }
 };
 }, [hospitalLat, hospitalLng, hospitalName, donorLat, donorLng]);

 const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${hospitalLat},${hospitalLng}`;

 return (
 <div className="w-full space-y-3">
 <div 
 ref={mapContainerRef} 
 className="relative z-10 h-[220px] w-full overflow-hidden border border-ink-200 sm:h-[260px]" 
 />
 <div className="flex items-center justify-between gap-3 border border-ink-100 bg-ink-50 p-3">
 <div className="text-xs text-ink-600">
 {distanceKm ? (
 <p>
 Distance: <strong className="font-mono font-bold tabular-nums text-ink-900">~{distanceKm} km</strong> away
 </p>
 ) : (
 <p>Hospital Location ready</p>
 )}
 </div>
 <a
 href={directionsUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 bg-blood-600 px-4 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-blood-700 active:bg-blood-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blood-600"
 >
 <Navigation className="w-3.5 h-3.5" /> Get Directions
 </a>
 </div>
 </div>
 );
}
