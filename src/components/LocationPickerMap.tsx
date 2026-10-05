import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

interface LocationPickerMapProps {
  location: LocationCoordinates | null;
  onChange: (loc: LocationCoordinates) => void;
}

// Custom luxury royal marker pin for Nasjah Atelier
const createCustomMarker = () => {
  return L.divIcon({
    className: 'nasjah-custom-marker',
    html: `
      <div style="position: relative; width: 36px; height: 36px; transform: translate(-50%, -100%);">
        <div style="
          width: 36px; 
          height: 36px; 
          background: #1D3A30; 
          border: 2.5px solid #C7B895; 
          border-radius: 50% 50% 50% 0; 
          transform: rotate(-45deg); 
          display: flex; 
          align-items: center; 
          justify-content: center;
          box-shadow: 0 4px 14px rgba(29, 58, 48, 0.45);
        ">
          <div style="
            width: 12px; 
            height: 12px; 
            background: #E8D5A8; 
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
};

export default function LocationPickerMap({ location, onChange }: LocationPickerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<{
    type: 'success' | 'error' | 'idle';
    message: string;
  }>({
    type: location ? 'success' : 'idle',
    message: location ? 'تم تحديد موقع التوصيل على الخريطة' : '',
  });

  // Default Bahrain Coordinates (Manama / Central Kingdom)
  const defaultBahrainLat = 26.2154;
  const defaultBahrainLng = 50.5832;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = location?.lat || defaultBahrainLat;
    const initialLng = location?.lng || defaultBahrainLng;
    const initialZoom = location ? 15 : 12;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const customIcon = createCustomMarker();

    // If initial location provided, add marker
    if (location) {
      const marker = L.marker([location.lat, location.lng], {
        icon: customIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange({ lat: pos.lat, lng: pos.lng });
        setGpsStatus({
          type: 'success',
          message: 'تم تحديث موقع التوصيل بالسحب والإفلات 🎯',
        });
      });

      markerRef.current = marker;
    }

    // Handle map click to place/move marker
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onChange({ lat, lng });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const newMarker = L.marker([lat, lng], {
          icon: customIcon,
          draggable: true,
        }).addTo(map);

        newMarker.on('dragend', () => {
          const pos = newMarker.getLatLng();
          onChange({ lat: pos.lat, lng: pos.lng });
          setGpsStatus({
            type: 'success',
            message: 'تم تحديث موقع التوصيل بالسحب والإفلات 🎯',
          });
        });

        markerRef.current = newMarker;
      }

      setGpsStatus({
        type: 'success',
        message: 'تم تثبيت نقطة التوصيل على الخريطة بنجاح 📍',
      });
    });

    mapInstanceRef.current = map;

    // Fix map rendering issues in modal/flex containers
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update marker position if location prop changes externally
  useEffect(() => {
    if (!mapInstanceRef.current || !location) return;

    const customIcon = createCustomMarker();

    if (markerRef.current) {
      markerRef.current.setLatLng([location.lat, location.lng]);
    } else {
      const newMarker = L.marker([location.lat, location.lng], {
        icon: customIcon,
        draggable: true,
      }).addTo(mapInstanceRef.current);

      newMarker.on('dragend', () => {
        const pos = newMarker.getLatLng();
        onChange({ lat: pos.lat, lng: pos.lng });
      });

      markerRef.current = newMarker;
    }
  }, [location?.lat, location?.lng]);

  // Handle GPS Auto-detect button
  const handleDetectGPSLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus({
        type: 'error',
        message: 'متصفحك لا يدعم تحديد الموقع التلقائي، يرجى النقر على الخريطة مباشرة.',
      });
      return;
    }

    setIsLocating(true);
    setGpsStatus({
      type: 'idle',
      message: 'جارِ تحديد موقعك الحالي بدقة عبر الأقمار الصناعية GPS...',
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude, longitude } = position.coords;
        const newLoc = { lat: latitude, lng: longitude };

        onChange(newLoc);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 16, { animate: true });
        }

        const customIcon = createCustomMarker();
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        } else if (mapInstanceRef.current) {
          const newMarker = L.marker([latitude, longitude], {
            icon: customIcon,
            draggable: true,
          }).addTo(mapInstanceRef.current);

          newMarker.on('dragend', () => {
            const pos = newMarker.getLatLng();
            onChange({ lat: pos.lat, lng: pos.lng });
          });

          markerRef.current = newMarker;
        }

        setGpsStatus({
          type: 'success',
          message: 'تم التقاط موقعك الجغرافي الدقيق بنجاح عبر GPS 🎯',
        });
      },
      (error) => {
        setIsLocating(false);
        let errorMsg = 'تعذر الوصول للموقع. يرجى تفعيل الـ GPS أو النقر على موقعك في الخريطة.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'تم رفض الإذن بمشاركة الموقع. يرجى النقر مباشرة على موقعك في الخريطة.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'استغرق تحديد الموقع وقتاً أطول من المتوقع، يرجى النقر على الخريطة.';
        }
        setGpsStatus({
          type: 'error',
          message: errorMsg,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  };

  const googleMapsUrl = location
    ? `https://maps.google.com/?q=${location.lat.toFixed(6)},${location.lng.toFixed(6)}`
    : null;

  return (
    <div className="space-y-2.5">
      {/* GPS Detection Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleDetectGPSLocation}
          disabled={isLocating}
          className="flex-1 py-2.5 px-3.5 rounded-xl bg-[#1D3A30] text-[#E8D5A8] border border-[#C7B895]/50 text-xs font-bold hover:bg-[#25493D] transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98 disabled:opacity-75"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#E8D5A8]" />
          ) : (
            <Navigation className="w-4 h-4 text-[#E8D5A8]" />
          )}
          <span>{isLocating ? 'جارِ تحديد موقعك بدقة...' : '📍 تحديد موقعي الحالي تلقائياً (GPS)'}</span>
        </button>

        {googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="py-2.5 px-3 rounded-xl bg-white border border-[#C7B895]/50 text-[#1D3A30] text-[11px] font-bold hover:bg-[#FAF7F0] transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            title="معاينة الموقع في خرائط Google"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#A99872]" />
            <span>عرض بـ Google Maps</span>
          </a>
        )}
      </div>

      {/* Status Notice */}
      {gpsStatus.message && (
        <div
          className={`p-2 rounded-xl text-[11px] font-bold flex items-center gap-2 transition ${
            gpsStatus.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : gpsStatus.type === 'error'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-[#FAF7F0] text-[#1D3A30]/80 border border-[#C7B895]/30'
          }`}
        >
          {gpsStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : gpsStatus.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          ) : (
            <MapPin className="w-4 h-4 text-[#A99872] flex-shrink-0" />
          )}
          <span className="truncate">{gpsStatus.message}</span>
        </div>
      )}

      {/* Interactive Leaflet Map Container */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-[#C7B895]/40 shadow-inner bg-[#FAF7F0]">
        <div
          ref={mapContainerRef}
          className="w-full h-52 sm:h-60 z-0"
          style={{ minHeight: '200px' }}
        />

        {/* Floating guidance overlay */}
        <div className="absolute bottom-2 inset-x-2 pointer-events-none z-10 flex justify-center">
          <div className="bg-[#1D3A30]/90 text-[#FAF7F0] backdrop-blur-xs px-3 py-1 rounded-full text-[10px] font-bold shadow-md border border-[#C7B895]/40 text-center">
            💡 يمكنك النقر في أي مكان على الخريطة أو سحب الدبوس لتحديد منزلك بدقة
          </div>
        </div>
      </div>
    </div>
  );
}
