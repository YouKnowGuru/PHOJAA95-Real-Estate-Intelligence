import { useState, useEffect, useRef, useCallback } from "react";
import { Navigation, Loader2, Crosshair, MapPin } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Modern, Free Map Picker using Leaflet and OpenStreetMap (CartoDB Tiles).
 * Improved with Geolocation and a premium look.
 */
export function GoogleMapPicker({
  value,
  onChange,
  disabled,
  label = "Location",
  height = "400px",
}: {
  value?: { lat: string; lng: string };
  onChange?: (data: { lat: string; lng: string; address?: string }) => void;
  disabled?: boolean;
  label?: string;
  height?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const defaultCenter: [number, number] = [27.4728, 89.6393];
  const center: [number, number] = value?.lat && value?.lng 
    ? [parseFloat(value.lat), parseFloat(value.lng)] 
    : defaultCenter;

  // Custom Modern Marker Icon (SVG)
  const modernIcon = L.divIcon({
    html: `<div class="flex items-center justify-center w-10 h-10 bg-primary rounded-full border-4 border-white shadow-lg transform -translate-y-1/2">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
           </div>`,
    className: "custom-div-icon",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: false, // Custom position below
      }).setView(center, 15);

      // Using CartoDB Voyager tiles for a much cleaner, modern look
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapInstanceRef.current);

      L.control.zoom({ position: "bottomright" }).addTo(mapInstanceRef.current);
    }

    // Update or create marker
    if (markerRef.current) {
      markerRef.current.setLatLng(center);
    } else {
      markerRef.current = L.marker(center, {
        draggable: !disabled,
        icon: modernIcon
      }).addTo(mapInstanceRef.current);

      markerRef.current.on("dragend", async (event) => {
        const marker = event.target;
        const position = marker.getLatLng();
        handleLocationChange(position.lat, position.lng);
      });
    }

    // Update marker draggability
    if (disabled) {
      markerRef.current.dragging?.disable();
    } else {
      markerRef.current.dragging?.enable();
    }
  }, [center, disabled, modernIcon]);

  const handleLocationChange = async (lat: number, lng: number) => {
    const latStr = lat.toString();
    const lngStr = lng.toString();
    
    onChange?.({ lat: latStr, lng: lngStr });

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      const addressStr = data.display_name || "";
      if (addressStr) {
        setAddress(addressStr);
      }
      onChange?.({ lat: latStr, lng: lngStr, address: addressStr });
    } catch {
      console.error("Failed to reverse geocode");
    }
  };

  const handleAddressSearch = useCallback(async () => {
    if (!address.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newLat = parseFloat(lat);
        const newLon = parseFloat(lon);
        
        onChange?.({ lat, lng: lon, address: display_name });

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([newLat, newLon], 16);
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([newLat, newLon]);
        }
      } else {
        setError("Location not found");
      }
    } catch {
      setError("Failed to search location");
    } finally {
      setLoading(false);
    }
  }, [address, onChange]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 16);
        }
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        }
        handleLocationChange(latitude, longitude);
        setLocating(false);
      },
      () => {
        setError("Unable to retrieve your location");
        setLocating(false);
      }
    );
  };

  return (
    <div className="space-y-4">
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {label}
          </Label>
          {value && (
            <span className="text-[10px] font-mono text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              {parseFloat(value.lat).toFixed(5)}, {parseFloat(value.lng).toFixed(5)}
            </span>
          )}
        </div>
      )}
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for a location or address..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddressSearch()}
            disabled={disabled || loading}
            className="pl-9 bg-white/50 backdrop-blur-sm border-slate-200 focus:border-primary focus:ring-primary/20 transition-all"
          />
        </div>
        <Button
          type="button"
          onClick={handleAddressSearch}
          disabled={disabled || loading}
          size="icon"
          className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
        </Button>
      </div>

      <div className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-sm ring-1 ring-slate-200/50">
        <div
          ref={mapRef}
          style={{ height, width: "100%" }}
          className="z-0 grayscale-[0.2] contrast-[1.1]"
        />
        
        {/* Locating Button Overlay */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handleLocateMe}
            disabled={disabled || locating}
            className="bg-white/90 backdrop-blur-sm hover:bg-white text-slate-700 shadow-md border border-slate-200"
            title="Locate Me"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
          </Button>
        </div>

        {/* Instructions Overlay */}
        {!disabled && (
          <div className="absolute bottom-4 left-4 z-10 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <p className="text-[10px] text-white font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              Drag the marker to set location
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
        </div>
      )}

      {/* Hidden inputs for form submission compatibility */}
      <Input type="hidden" value={value?.lat || ""} name="latitude" />
      <Input type="hidden" value={value?.lng || ""} name="longitude" />

      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container { font-family: inherit; }
        .leaflet-bar { border: none !important; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important; }
        .leaflet-bar a { background-color: rgba(255, 255, 255, 0.9) !important; color: #64748b !important; border: 1px solid #e2e8f0 !important; }
        .leaflet-bar a:hover { background-color: #ffffff !important; color: hsl(var(--primary)) !important; }
        .custom-div-icon { background: none; border: none; }
      `}} />
    </div>
  );
}
