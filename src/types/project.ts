export type ProjectProjection = 'mercator' | 'geodesic';

export interface ViewData {
  topPanelOpen: boolean;
  sidePanelOpen: boolean;
  pdfPanelOpen?: boolean;
  pdfPanelWidth?: number;
  pdfCurrentPage?: number;
  pdfZoomLevel?: number;
  pdfScrollPosition?: { x: number; y: number };
  mapView?: {
    lat: number;
    lon: number;
    zoom: number;
  };
}

export interface ProjectData {
  id?: string;
  name: string;
  data: ProjectLayerData;
  projection?: ProjectProjection;
  viewData?: ViewData;
  pdfData?: string; // Base64 encoded PDF data
  pdfName?: string; // Original PDF filename
  pdfPassword?: string; // Password for encrypted PDFs
  createdAt?: number;
  updatedAt?: number;
}

export interface ProjectLayerData {
  circles: CircleElement[];
  lineSegments: LineSegmentElement[];
  points: PointElement[];
  polygons: PolygonElement[];
  notes: NoteElement[];
  savedCoordinates?: LegacyCoordinate[];
}

export interface CircleElement {
  listOrder?: number; // Manual order within the sidebar category
  id: string;
  name: string;
  center: { lat: number; lon: number };
  radius: number;
  color?: string;
  noteId?: string; // ID of the linked note (one-to-one)
  createdAt?: number;
}

export interface LineSegmentElement {
  listOrder?: number; // Manual order within the sidebar category
  id: string;
  name: string;
  center: { lat: number; lon: number };
  endpoint?: { lat: number; lon: number };
  mode: 'coordinate' | 'azimuth' | 'intersection' | 'parallel';
  distance?: number;
  azimuth?: number;
  angleFrom?: { lineId: string; degrees: number };
  intersectionPoint?: { lat: number; lon: number };
  intersectionDistance?: number;
  intersectionExtension?: number; // Kilometers beyond the intersection point
  longitude?: number;
  color?: string;
  noteId?: string; // ID of the linked note (one-to-one)
  createdAt?: number;
  // Point references: IDs of points that are on this line
  startPointId?: string; // ID of the point at the start position
  endPointId?: string; // ID of the point at the end position
  pointsOnLine?: string[]; // IDs of points that lie on this line (excluding start/end)
}

export interface PointElement {
  listOrder?: number; // Manual order within the sidebar category
  id: string;
  name: string;
  coordinates: { lat: number; lon: number };
  elevation?: number;
  // Recorded only for generated points; ordinary coordinate points remain fixed.
  construction?: { lineId: string; distanceKm?: number; fromEnd?: boolean };
  color?: string;
  noteId?: string; // ID of the linked note (one-to-one)
  createdAt?: number;
  // Line reference: ID of the line that contains this point (bidirectional relationship: 1 point => 0 or 1 line)
  lineId?: string; // ID of line where this point appears in pointsOnLine, startPointId, or endPointId
  // Polygon references: IDs of polygons that use this point (bidirectional relationship: 1 point => 0 or many polygons)
  polygonIds?: string[]; // IDs of polygons where this point appears in pointIds array
}

export interface PolygonElement {
  listOrder?: number; // Manual order within the sidebar category
  id: string;
  name: string;
  pointIds: string[]; // Array of PointElement IDs (minimum 3) - bidirectional relationship with PointElement.polygonIds
  color?: string;
  noteId?: string; // ID of the linked note (one-to-one)
  createdAt?: number;
}

export interface NoteElement {
  listOrder?: number; // Manual order within the sidebar category
  id: string;
  title: string;
  content: string;
  linkedElementType?: ElementType;
  linkedElementId?: string;
  createdAt?: number;
  updatedAt?: number;
}

export type ElementType = 'circle' | 'lineSegment' | 'point' | 'polygon';
export type DrawingElement = CircleElement | LineSegmentElement | PointElement | PolygonElement;

export interface LegacyCoordinate {
  id: string;
  name: string;
  lat: number;
  lon: number;
  timestamp?: number;
}

export type LayerImportData = Omit<ProjectLayerData, 'polygons' | 'notes'> & {
  polygons?: Array<PolygonElement | LegacyPolygon>;
  notes?: NoteElement[];
  savedCoordinates?: LegacyCoordinate[];
};

export interface LegacyPolygon extends Omit<PolygonElement, 'pointIds'> {
  points: Array<{ lat: number; lon: number }>;
  pointIds?: undefined;
}
