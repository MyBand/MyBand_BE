import { EventEmitter } from 'events';
import type { MessageResponse } from '../dtos/message.dto';

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const topicFor = (bandId: string): string => `band:${bandId}`;

export const chatHub = {
  publish(bandId: string, message: MessageResponse): void {
    emitter.emit(topicFor(bandId), message);
  },

  subscribe(
    bandId: string,
    listener: (message: MessageResponse) => void,
  ): () => void {
    const topic = topicFor(bandId);
    emitter.on(topic, listener);
    return () => emitter.off(topic, listener);
  },
};
