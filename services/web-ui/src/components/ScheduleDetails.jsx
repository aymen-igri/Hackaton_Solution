import { useState } from "react";

const TEAMS = ["Team Alpha", "Team Beta", "Team Gamma", "Team Delta", "Team Epsilon"];
const MEMBERS = [
  "John Smith", "Sarah Johnson", "Mike Chen", "Emma Wilson",
  "Tom Anderson", "Lisa Brown", "David Lee", "Amy Zhang", "Chris Taylor"
];
const SHIFTS = [
  "Morning (6:00 AM - 2:00 PM)",
  "Afternoon (2:00 PM - 10:00 PM)", 
  "Night (10:00 PM - 6:00 AM)",
  "Overnight (11:00 PM - 7:00 AM)",
  "Day Shift (8:00 AM - 4:00 PM)"
];

export const ScheduleDetails = ({ schedule, onClose, onUpdate, isAddingNew }) => {
  const [form, setForm] = useState({
    ...schedule
  });

  const confirmChanges = () => {
    onUpdate(form);
    onClose();
  };

  const f = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const inputBase = {
    boxSizing: "border-box",
    background: "#0d0d0d",
    border: "1px solid #3a3a3a",
    borderRadius: 4,
    color: "#f0f0f0",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    padding: "7px 10px",
    transition: "border-color .15s",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 999,
        backdropFilter: "blur(2px)",
      }}
    >
      {/* Modal panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1c1c1c",
          border: "1px solid #3a3a3a",
          borderRadius: 8,
          width: "100%", maxWidth: 460,
          margin: "0 16px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.85)",
        }}
      >
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px", borderBottom: "1px solid #2a2a2a",
        }}>
          <span style={{ fontSize: 17, fontWeight: 400 }}>
            {isAddingNew ? "Add Schedule" : "Schedule details"}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid #3a3a3a", borderRadius: 5,
              color: "#888", width: 28, height: 28, cursor: "pointer",
              fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#666"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#3a3a3a"; e.currentTarget.style.color = "#888"; }}
          >×</button>
        </div>

        {/* Modal body */}
        <div style={{ padding: "22px 22px 26px" }}>

          {/* Team */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: "#ccc", minWidth: 80 }}>Team:</label>
            <select
              style={{ ...inputBase, flex: 1, cursor: "pointer" }}
              value={form.team}
              onChange={f("team")}
              onFocus={(e) => (e.target.style.borderColor = "#666")}
              onBlur={(e) => (e.target.style.borderColor = "#3a3a3a")}
            >
              {TEAMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Member */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: "#ccc", minWidth: 80 }}>Member:</label>
            <select
              style={{ ...inputBase, flex: 1, cursor: "pointer" }}
              value={form.member}
              onChange={f("member")}
              onFocus={(e) => (e.target.style.borderColor = "#666")}
              onBlur={(e) => (e.target.style.borderColor = "#3a3a3a")}
            >
              {MEMBERS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Shift */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: "#ccc", minWidth: 80 }}>Shift:</label>
            <select
              style={{ ...inputBase, flex: 1, cursor: "pointer" }}
              value={form.shift}
              onChange={f("shift")}
              onFocus={(e) => (e.target.style.borderColor = "#666")}
              onBlur={(e) => (e.target.style.borderColor = "#3a3a3a")}
            >
              {SHIFTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <label style={{ fontSize: 13, color: "#ccc", minWidth: 80 }}>Date:</label>
            <input
              type="date"
              style={{ ...inputBase, flex: 1 }}
              value={form.date}
              onChange={f("date")}
              onFocus={(e) => (e.target.style.borderColor = "#666")}
              onBlur={(e) => (e.target.style.borderColor = "#3a3a3a")}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={confirmChanges}
              style={{
                padding: "10px 28px", borderRadius: 6, cursor: "pointer",
                background: "transparent", border: "1px solid #fff",
                color: "#fff", fontSize: 13, fontWeight: 500, fontFamily: "inherit",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#000"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#fff"; }}
            >
              {isAddingNew ? "Add Schedule" : "Update Schedule"}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "10px 28px", borderRadius: 6, cursor: "pointer",
                background: "transparent", border: "1px solid #444",
                color: "#aaa", fontSize: 13, fontWeight: 500, fontFamily: "inherit",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#777"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#444"; e.currentTarget.style.color = "#aaa"; }}
            >Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};