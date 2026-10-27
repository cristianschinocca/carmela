import { ExternalLink, MapPin } from "lucide-react";
import { business } from "../config/business";

export function BusinessMap() {
  return (
    <div className="business-map">
      <iframe
        title="Mapa de Carmela, Salumería y café"
        src={business.mapsEmbedUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        tabIndex={-1}
      />
      <a
        className="business-map-link"
        href={business.mapsUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Abrir la ubicación de Carmela en Google Maps"
      >
        <span className="map-pin">
          <MapPin size={20} />
        </span>
        <span className="map-address">
          <small>DÓNDE ESTAMOS</small>
          <strong>{business.address}</strong>
          <span>{business.addressRegion}</span>
        </span>
        <span className="map-cta">
          Cómo llegar <ExternalLink size={14} />
        </span>
      </a>
    </div>
  );
}
