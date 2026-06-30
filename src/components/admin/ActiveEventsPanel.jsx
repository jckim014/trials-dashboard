import React, { useEffect, useState } from "react";
import {
  getEvents,
  getPlayers,
  updateEvent,
  finalizeEvent,
  getTrialNames,
  setEventOrder,
} from "../../data/schema.js";
import EventList from "../shared/EventList.jsx";
import CompleteEventModal from "./CompleteEventModal.jsx";
import EditSquadsModal from "./EditSquadsModal.jsx";
import EditEventModal from "./EditEventModal.jsx";
import SquadDisplay from "../shared/SquadDisplay.jsx";
import DraggableSquadDisplay from "./DraggableSquadDisplay.jsx";

function formatLocalTime(ts) {
  if (!ts) return "TBD";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
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

export default function ActiveEventsPanel() {
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [trialNamesByWeek, setTrialNamesByWeek] = useState({}); // { [weekKey]: { 1: 'Search cars', ... } }
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(null);
  const [completingEvent, setCompletingEvent] = useState(null); // event pending the Complete modal
  const [editingEvent, setEditingEvent] = useState(null); // event pending the Edit Event modal

  async function load() {
    const [evts, plyrs] = await Promise.all([getEvents(), getPlayers()]);
    setEvents(evts);
    setPlayers(plyrs);

    // Load trial names for every distinct week present among the events,
    // so each card can show the current custom trial name, not just "Trial N".
    const weekKeys = [...new Set(evts.map((e) => e.weekKey))];
    const namesEntries = await Promise.all(
      weekKeys.map(async (wk) => [wk, await getTrialNames(wk)]),
    );
    setTrialNamesByWeek(Object.fromEntries(namesEntries));

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleFinalize(event, status) {
    if (status === "success") {
      setCompletingEvent(event);
      return;
    }

    const confirmMsg =
      status === "cancelled"
        ? "Cancel this event? No points will be awarded."
        : "Mark as Incomplete? Support squads get +1 contribution. Scoring squad gets no score-achieved point.";
    if (!window.confirm(confirmMsg)) return;
    setFinalizing(event.id);
    await finalizeEvent(event, status);
    await load();
    setFinalizing(null);
  }

  async function handleConfirmComplete(score) {
    if (!completingEvent) return;
    setFinalizing(completingEvent.id);
    await finalizeEvent(completingEvent, "success", score);
    await load();
    setFinalizing(null);
    setCompletingEvent(null);
  }

  async function handleReorder(orderedIds) {
    // Optimistically reorder in local state so the drag feels instant.
    // Must stamp matching .order values onto the local copies too —
    // otherwise the very next render's sort-by-.order in sortedEvents
    // would immediately undo the reorder using stale order numbers.
    setEvents((prev) => {
      const byId = Object.fromEntries(prev.map((e) => [e.id, e]));
      const reorderedUpcoming = orderedIds.map((id, index) => ({
        ...byId[id],
        order: index,
      }));
      const rest = prev.filter((e) => e.status !== "active");
      return [...reorderedUpcoming, ...rest];
    });
    await setEventOrder(orderedIds);
  }

  if (loading) return <p>Loading events...</p>;

  const playersById = Object.fromEntries(players.map((p) => [p.id, p]));

  // Sort upcoming events by manual order (falling back to startTime for
  // events created before the order field existed); past events keep
  // whatever order EventList groups them in internally.
  const sortedEvents = [...events].sort((a, b) => {
    if (a.status === "active" && b.status === "active") {
      const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aTime = a.startTime?.toMillis?.() ?? new Date(a.startTime).getTime();
      const bTime = b.startTime?.toMillis?.() ?? new Date(b.startTime).getTime();
      return aTime - bTime;
    }
    return 0; // EventList handles past-event ordering internally
  });

  const scoringMemberNames = completingEvent
    ? (completingEvent.squads || [])
        .find((s) => s.label === "scoring")
        ?.memberIds.map((id) => playersById[id]?.name || "?") || []
    : [];

  const completingTrialName = completingEvent
    ? completingEvent.trialNumber
      ? trialNamesByWeek[completingEvent.weekKey]?.[
          completingEvent.trialNumber
        ] || `Trial ${completingEvent.trialNumber}`
      : "Trial (not set)"
    : "";

  return (
    <>
      <EventList
        events={sortedEvents}
        emptyMessage="No upcoming events. Create one in the Create Event tab."
        reorderable
        onReorder={handleReorder}
        renderCard={(event, { dragHandleProps }) => (
          <EventAdminCard
            key={event.id}
            event={event}
            playersById={playersById}
            players={players}
            trialName={
              event.trialNumber
                ? trialNamesByWeek[event.weekKey]?.[event.trialNumber] ||
                  `Trial ${event.trialNumber}`
                : null
            }
            onFinalize={handleFinalize}
            onEdit={() => setEditingEvent(event)}
            finalizing={finalizing === event.id}
            onUpdate={load}
            readonly={event.status !== "active"}
            dragHandleProps={dragHandleProps}
          />
        )}
      />

      {completingEvent && (
        <CompleteEventModal
          event={completingEvent}
          trialName={completingTrialName}
          scoringMemberNames={scoringMemberNames}
          onConfirm={handleConfirmComplete}
          onCancel={() => setCompletingEvent(null)}
          saving={finalizing === completingEvent.id}
        />
      )}

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onSaved={() => { setEditingEvent(null); load(); }}
          onCancel={() => setEditingEvent(null)}
        />
      )}
    </>
  );
}

function supportLabel(squads, squadIndex) {
  const supportNum =
    squads.slice(0, squadIndex).filter((s) => s.label === "support").length + 1;
  return `Support ${supportNum}`;
}

function EventAdminCard({
  event,
  playersById,
  players,
  trialName,
  onFinalize,
  onEdit,
  finalizing,
  onUpdate,
  readonly = false,
  dragHandleProps,
}) {
  const [editingSquads, setEditingSquads] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveSquads(squads) {
    setSaving(true);
    await updateEvent(event.id, { squads });
    setEditingSquads(false);
    setSaving(false);
    onUpdate();
  }

  async function handleDragSave(squads) {
    await updateEvent(event.id, { squads });
    onUpdate();
  }

  return (
    <>
      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <div className="card-header">
          <div>
            <div className="card-title">{event.title}</div>
            <div className="card-meta">
              {event.map} · {event.condition} ·{" "}
              {formatLocalTime(event.startTime)}
              {trialName && (
                <>
                  {" "}
                  · <span style={{ color: "var(--scoring)" }}>{trialName}</span>
                </>
              )}
            </div>
            {event.description && (
              <p style={{ marginTop: "0.35rem", fontSize: 13 }}>
                {event.description}
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className={"badge " + event.status}>
              {STATUS_LABELS[event.status] || event.status}
            </span>
            {!readonly && dragHandleProps && (
              <span
                {...dragHandleProps}
                title="Drag to reorder"
                style={{
                  fontSize: 16, color: "var(--muted)", cursor: "grab",
                  userSelect: "none", lineHeight: 1, padding: "0.2rem",
                }}
              >
                ⠿
              </span>
            )}
          </div>
        </div>

        {/* Squads */}
        <div style={{ marginTop: "0.75rem" }}>
          {readonly ? (
            <SquadDisplay squads={event.squads} playersById={playersById} />
          ) : (
            <DraggableSquadDisplay
              squads={event.squads}
              playersById={playersById}
              onSquadsChange={handleDragSave}
              trialNumber={event.trialNumber}
            />
          )}
          {!readonly && (
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
              <button onClick={() => setEditingSquads(true)} style={{ fontSize: 12 }}>
                Edit Squads
              </button>
              <button onClick={onEdit} style={{ fontSize: 12 }}>
                Edit Event
              </button>
            </div>
          )}
        </div>

        {/* Finalize controls */}
        {!readonly && (
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              gap: "0.5rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid var(--border2)",
            }}
          >
            <button
              className="btn-success"
              onClick={() => onFinalize(event, "success")}
              disabled={finalizing}
            >
              Complete
            </button>
            <button
              className="btn-danger"
              onClick={() => onFinalize(event, "failed")}
              disabled={finalizing}
            >
              Incomplete
            </button>
            <button
              className="btn-neutral"
              onClick={() => onFinalize(event, "cancelled")}
              disabled={finalizing}
            >
              Cancel Event
            </button>
          </div>
        )}
      </div>

      {/* Squad edit modal */}
      {editingSquads && (
        <EditSquadsModal
          event={event}
          players={players}
          playersById={playersById}
          onSave={saveSquads}
          onCancel={() => setEditingSquads(false)}
          saving={saving}
        />
      )}
    </>
  );
}
