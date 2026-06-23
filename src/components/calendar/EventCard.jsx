import React from "react";
import SquadDisplay from "../shared/SquadDisplay.jsx";

function formatLocalTime(timestamp) {
  if (!timestamp) return "TBD";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

const STATUS_LABELS = {
  active: "Upcoming",
  success: "Complete",
  failed: "Incomplete",
  cancelled: "Cancelled",
};

export default function EventCard({ event, playersById, trialName }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{event.title}</div>
          <div className="card-meta">
            {event.map} · {event.condition} · {formatLocalTime(event.startTime)}
            {trialName && (
              <>
                {" "}
                · <span style={{ color: "var(--scoring)" }}>{trialName}</span>
              </>
            )}
          </div>
          {event.description && (
            <p style={{ marginTop: "0.4rem", fontSize: 13 }}>
              {event.description}
            </p>
          )}
        </div>
        <span className={"badge " + event.status}>
          {STATUS_LABELS[event.status] || event.status}
        </span>
      </div>
      <SquadDisplay squads={event.squads} playersById={playersById} />
    </div>
  );
}
