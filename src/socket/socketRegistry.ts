import type { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setIo(io: SocketIOServer): void {
  ioInstance = io;
}

export function getIo(): SocketIOServer | null {
  return ioInstance;
}
