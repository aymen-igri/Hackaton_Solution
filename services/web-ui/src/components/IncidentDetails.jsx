import { useState } from "react";

const TEAM = [
  "John Smith", "Sarah Johnson", "Mike Chen", "Emma Wilson",
  "Tom Anderson", "Lisa Brown", "David Lee", "Amy Zhang", "Chris Taylor",
];

export const IncidentDetails = ({ incident, onClose, onUpdate }) => {
  const [form, setForm] = useState({
    ...incident,
    note: incident.note || ''
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
          <span style={{ fontSize: 17, fontWeight: 400 }}>Incident details</span>
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

          {/* Title */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: "#ccc", minWidth: 80 }}>Title:</label>
            <input
              style={{ ...inputBase, flex: 1 }}
              value={form.title}
              onChange={f("title")}
              onFocus={(e) => (e.target.style.borderColor = "#666")}
              onBlur={(e) => (e.target.style.borderColor = "#3a3a3a")}
            />
          </div>

          {/* Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: "#ccc", minWidth: 80 }}>Status:</label>
            <select
              style={{ ...inputBase, width: 160, cursor: "pointer" }}
              value={form.status}
              onChange={f("status")}
              onFocus={(e) => (e.target.style.borderColor = "#666")}
              onBlur={(e) => (e.target.style.borderColor = "#3a3a3a")}
            >
              {["Open", "In Progress", "Pending", "Resolved", "Closed"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Assigned to */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <label style={{ fontSize: 13, color: "#ccc", minWidth: 80 }}>Assigned to:</label>
            <select
              style={{ ...inputBase, width: 180, cursor: "pointer" }}
              value={form.assignedTo}
              onChange={f("assignedTo")}
              onFocus={(e) => (e.target.style.borderColor = "#666")}
              onBlur={(e) => (e.target.style.borderColor = "#3a3a3a")}
            >
              {TEAM.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          {/* Note */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 13, color: "#ccc", display: "block", marginBottom: 8 }}>Note:</label>
            <textarea
              rows={5}
              style={{ ...inputBase, width: "100%", resize: "vertical", lineHeight: 1.55 }}
              value={form.note}
              onChange={f("note")}
              placeholder="Add notes about this incident…"
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
            >Confirm changes</button>
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