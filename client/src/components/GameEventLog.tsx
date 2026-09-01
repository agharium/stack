import type { GameEvent } from "../../../shared/types";

export function GameEventList({ events }: { events: GameEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm font-semibold text-white/55">
        Nenhuma jogada registrada ainda.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {[...events].reverse().map((event) => (
        <li key={event.id} className="text-sm font-semibold leading-snug">
          {event.text}
        </li>
      ))}
    </ol>
  );
}
