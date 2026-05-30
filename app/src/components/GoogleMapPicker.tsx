import { useState, useEffect, useRef, useCallback } from "react";
import { Navigation, Loader2, Crosshair, MapPin, X, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
}

/**
 * Improved Map Picker using Leaflet with Google Satellite tiles.
 * Features:
 * - Click anywhere on map to drop pin
 * - Drag marker to adjust
 * - Smart address search with autocomplete suggestions
 * - Geolocation (Locate Me)
 * - Satellite + Roads hybrid view
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
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const isInitializedRef = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const defaultCenter: [number, number] = [27.4728, 89.6393];
  const lat = value?.lat ? parseFloat(value.lat) : defaultCenter[0];
  const lng = value?.lng ? parseFloat(value.lng) : defaultCenter[1];

  // Create marker icon
  const createIcon = useCallback(() => {
    return L.divIcon({
      html: `<div style="
        display:flex;align-items:center;justify-content:center;
        width:36px;height:36px;background:#0f766e;
        border-radius:50%;border:3px solid white;
        box-shadow:0 4px 12px rgba(0,0,0,0.3);
        transform:translateY(-50%);
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>`,
      className: "custom-pin-icon",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20],
    });
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || isInitializedRef.current) return;
    isInitializedRef.current = true;

    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView([lat, lng], 15);

    mapInstanceRef.current = map;

    // Google Satellite base layer
    L.tileLayer(
      "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      {
        attribution: '&copy; <a href="https://www.google.com/maps">Google</a>',
        maxZoom: 22,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
      }
    ).addTo(map);

    // Google Roads & Labels overlay
    L.tileLayer(
      "https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}",
      {
        attribution: '&copy; <a href="https://www.google.com/maps">Google</a>',
        maxZoom: 22,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
      }
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Create initial marker
    const marker = L.marker([lat, lng], {
      draggable: !disabled,
      icon: createIcon(),
    }).addTo(map);

    markerRef.current = marker;

    // Marker drag end
    marker.on("dragend", (event) => {
      const pos = event.target.getLatLng();
      handleLocationChange(pos.lat, pos.lng);
    });

    // Click on map to move marker
    map.on("click", (e) => {
      if (disabled) return;
      const { lat: clickLat, lng: clickLng } = e.latlng;
      marker.setLatLng([clickLat, clickLng]);
      handleLocationChange(clickLat, clickLng);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapRef.current) {
      resizeObserver.observe(mapRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      isInitializedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update marker position when value changes externally
  useEffect(() => {
    if (!markerRef.current || !mapInstanceRef.current) return;
    const currentPos = markerRef.current.getLatLng();
    const newLat = parseFloat(value?.lat || lat.toString());
    const newLng = parseFloat(value?.lng || lng.toString());

    if (
      Math.abs(currentPos.lat - newLat) > 0.00001 ||
      Math.abs(currentPos.lng - newLng) > 0.00001
    ) {
      markerRef.current.setLatLng([newLat, newLng]);
      mapInstanceRef.current.panTo([newLat, newLng]);
    }
  }, [value?.lat, value?.lng]);

  // Update draggability when disabled changes
  useEffect(() => {
    if (!markerRef.current) return;
    if (disabled) {
      markerRef.current.dragging?.disable();
    } else {
      markerRef.current.dragging?.enable();
    }
  }, [disabled]);

  const handleLocationChange = async (newLat: number, newLng: number) => {
    const latStr = newLat.toFixed(8);
    const lngStr = newLng.toFixed(8);

    // Use ref to always call the latest onChange (avoids stale closure)
    onChangeRef.current?.({ lat: latStr, lng: lngStr });

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}`
      );
      const data = await response.json();
      const addressStr = data.display_name || "";
      if (addressStr) {
        setSearchQuery(addressStr);
        // Hide suggestions when setting from map click to prevent overlay blocking the page
        setShowSuggestions(false);
      }
      onChangeRef.current?.({ lat: latStr, lng: lngStr, address: addressStr });
    } catch {
      console.error("Failed to reverse geocode");
    }
  };

  // Fetch search suggestions with debounce
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
      );
      const data = await response.json();
      setSuggestions(data || []);
      setShowSuggestions(data && data.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(searchQuery);
    }, 400);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, fetchSuggestions]);

  // Close suggestions when clicking outside the search container
  useEffect(() => {
    if (!showSuggestions) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions]);

  const selectSuggestion = (result: SearchResult) => {
    setSearchQuery(result.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);

    const newLat = parseFloat(result.lat);
    const newLon = parseFloat(result.lon);

    onChangeRef.current?.({
      lat: result.lat,
      lng: result.lon,
      address: result.display_name,
    });

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([newLat, newLon], 16);
      markerRef.current.setLatLng([newLat, newLon]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddressSearch();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          selectSuggestion(suggestions[activeIndex]);
        } else {
          handleAddressSearch();
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setActiveIndex(-1);
        break;
    }
  };

  const handleAddressSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setShowSuggestions(false);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat: resultLat, lon: resultLon, display_name } = data[0];
        const newLat = parseFloat(resultLat);
        const newLon = parseFloat(resultLon);

        setSearchQuery(display_name);
        onChangeRef.current?.({ lat: resultLat, lng: resultLon, address: display_name });

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([newLat, newLon], 16);
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
  }, [searchQuery, onChange]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 16);
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

  const clearSearch = () => {
    setSearchQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
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

      {/* Search Bar with Autocomplete */}
      <div className="relative" ref={searchContainerRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search for a location or address..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              disabled={disabled || loading}
              className="pl-9 pr-9 bg-white/50 backdrop-blur-sm border-slate-200 focus:border-primary focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
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

        {/* Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((result, index) => (
              <button
                key={index}
                type="button"
                onClick={() => selectSuggestion(result)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-start gap-2 ${
                  index === activeIndex
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-slate-50 dark:hover:bg-slate-700/50 text-foreground"
                }`}
              >
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{result.display_name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {result.type} &middot; {result.class}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}


      </div>

      {/* Map Container */}
      <div className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-sm ring-1 ring-slate-200/50">
        <div
          ref={mapRef}
          style={{ height, width: "100%" }}
          className="z-0"
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
              Click map or drag pin to set location
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

      {/* Leaflet custom styles — injected safely via template literal (no user input) */}
      <style>{`
        .leaflet-container { font-family: inherit; }
        .leaflet-bar { border: none !important; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important; }
        .leaflet-bar a { background-color: rgba(255, 255, 255, 0.9) !important; color: #64748b !important; border: 1px solid #e2e8f0 !important; }
        .leaflet-bar a:hover { background-color: #ffffff !important; color: hsl(var(--primary)) !important; }
        .custom-pin-icon { background: none !important; border: none !important; }
      `}</style>
    </div>
  );
}
