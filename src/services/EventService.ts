import crypto from 'crypto';
import {
  EventRepository,
  type DateRange,
} from '../repositories/EventRepository';
import { BandMemberService } from './BandMemberService';
import { NotFoundError } from '../errors/HttpError';
import type {
  CreateEventRequest,
  EventResponse,
  EventType,
  SetlistItem,
  SetlistItemRequest,
  UpdateEventRequest,
} from '../dtos/event.dto';

type EventRow = {
  id: string;
  bandId: string;
  title: string;
  date: string;
  type: string;
  description: string | null;
  setlist: unknown;
};

export class EventService {
  constructor(
    private readonly events = new EventRepository(),
    private readonly memberService = new BandMemberService(),
  ) {}

  async list(
    bandId: string,
    requesterId: string,
    range: DateRange,
  ): Promise<EventResponse[]> {
    await this.memberService.assertMember(bandId, requesterId);
    const rows = await this.events.findByBand(bandId, range);
    return rows.map(toResponse);
  }

  async get(
    bandId: string,
    eventId: string,
    requesterId: string,
  ): Promise<EventResponse> {
    await this.memberService.assertMember(bandId, requesterId);
    const event = await this.findScoped(bandId, eventId);
    return toResponse(event);
  }

  async create(
    bandId: string,
    requesterId: string,
    body: CreateEventRequest,
  ): Promise<EventResponse> {
    await this.memberService.assertMember(bandId, requesterId);
    const setlist = normalizeSetlist(body.setlist);
    const created = await this.events.create({
      bandId,
      title: body.title,
      date: body.date,
      type: body.type,
      description: body.description ?? null,
      setlist,
    });
    return toResponse(created);
  }

  async update(
    bandId: string,
    eventId: string,
    requesterId: string,
    body: UpdateEventRequest,
  ): Promise<EventResponse> {
    await this.memberService.assertMember(bandId, requesterId);
    await this.findScoped(bandId, eventId);
    const updated = await this.events.update(eventId, {
      title: body.title,
      date: body.date,
      type: body.type,
      description: body.description,
      ...(body.setlist !== undefined
        ? { setlist: normalizeSetlist(body.setlist) }
        : {}),
    });
    return toResponse(updated);
  }

  async remove(
    bandId: string,
    eventId: string,
    requesterId: string,
  ): Promise<void> {
    await this.memberService.assertMember(bandId, requesterId);
    await this.findScoped(bandId, eventId);
    await this.events.delete(eventId);
  }

  private async findScoped(bandId: string, eventId: string): Promise<EventRow> {
    const event = await this.events.findById(eventId);
    if (!event || event.bandId !== bandId) {
      throw new NotFoundError(`Event ${eventId} not found in band ${bandId}`);
    }
    return event as EventRow;
  }
}

function normalizeSetlist(
  items: SetlistItemRequest[] | undefined,
): SetlistItem[] {
  if (!items) return [];
  return items.map((it) => ({
    id: it.id ?? crypto.randomUUID(),
    title: it.title,
    artist: it.artist,
    key: it.key ?? null,
    sheetMusicUrl: it.sheetMusicUrl ?? null,
    references: it.references ?? [],
  }));
}

function toResponse(row: EventRow): EventResponse {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    type: row.type as EventType,
    description: row.description,
    setlist: Array.isArray(row.setlist)
      ? (row.setlist as SetlistItem[])
      : [],
  };
}
