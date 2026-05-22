/**
 * In-memory, non-persisted party runtime state.
 *
 * Two things live here rather than in SQLite:
 *  - Presence: which users are currently connected, tracked per party. A user
 *    may hold several sockets (multiple tabs / a reload mid-flight), so we
 *    ref-count socket ids and only consider a user offline when the last one
 *    drops. This is the "live user session array" backing the room.
 *  - Playback: the host's play/pause state. It is ephemeral coordination, not
 *    game data, so it has no schema column.
 */
class PartyRuntime {
  /** partyId -> userId -> set of live socket ids. */
  private readonly rooms = new Map<string, Map<string, Set<string>>>();
  /** socketId -> its binding, for O(1) cleanup on disconnect. */
  private readonly socketBindings = new Map<string, { partyId: string; userId: string }>();
  /** partyId -> isPlaying. */
  private readonly playback = new Map<string, boolean>();

  /** Associate a socket with a (party, user). Safe to call repeatedly. */
  bind(socketId: string, partyId: string, userId: string): void {
    this.socketBindings.set(socketId, { partyId, userId });

    let users = this.rooms.get(partyId);
    if (!users) {
      users = new Map();
      this.rooms.set(partyId, users);
    }

    let sockets = users.get(userId);
    if (!sockets) {
      sockets = new Set();
      users.set(userId, sockets);
    }
    sockets.add(socketId);
  }

  /** Drop a socket. Returns its binding so the caller can re-broadcast presence. */
  unbind(socketId: string): { partyId: string; userId: string } | null {
    const binding = this.socketBindings.get(socketId);
    if (!binding) return null;
    this.socketBindings.delete(socketId);

    const users = this.rooms.get(binding.partyId);
    const sockets = users?.get(binding.userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) users!.delete(binding.userId);
    }
    if (users && users.size === 0) {
      this.rooms.delete(binding.partyId);
      this.playback.delete(binding.partyId);
    }
    return binding;
  }

  /** User ids currently holding at least one live socket in the party. */
  onlineUserIds(partyId: string): string[] {
    return [...(this.rooms.get(partyId)?.keys() ?? [])];
  }

  isOnline(partyId: string, userId: string): boolean {
    return (this.rooms.get(partyId)?.get(userId)?.size ?? 0) > 0;
  }

  setPlaying(partyId: string, isPlaying: boolean): void {
    this.playback.set(partyId, isPlaying);
  }

  isPlaying(partyId: string): boolean {
    return this.playback.get(partyId) ?? false;
  }
}

export const runtime = new PartyRuntime();
