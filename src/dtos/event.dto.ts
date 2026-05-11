export type EventType = 'practice' | 'performance' | 'other';

export interface SetlistItem {
  id: string;
  title: string;
  artist: string;
  key: string | null;
  sheetMusicUrl: string | null;
  references: string[];
}

export interface SetlistItemRequest {
  id?: string;
  title: string;
  artist: string;
  key?: string;
  sheetMusicUrl?: string;
  references?: string[];
}

export interface EventResponse {
  id: string;
  title: string;
  date: string;
  type: EventType;
  description: string | null;
  setlist: SetlistItem[];
}

export interface CreateEventRequest {
  title: string;
  date: string;
  type: EventType;
  description?: string;
  setlist?: SetlistItemRequest[];
}

export interface UpdateEventRequest {
  title?: string;
  date?: string;
  type?: EventType;
  description?: string;
  setlist?: SetlistItemRequest[];
}
