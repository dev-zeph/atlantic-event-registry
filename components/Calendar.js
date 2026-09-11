import { useState } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isoDate(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

export default function Calendar({ dates, initialYear, initialMonth }) {
  const [year, setYear] = useState(initialYear);
  const [monthIndex, setMonthIndex] = useState(initialMonth);
  const [hovered, setHovered] = useState(null);

  const entriesByDate = new Map();
  for (const entry of dates) {
    const list = entriesByDate.get(entry.date) || [];
    list.push(entry);
    entriesByDate.set(entry.date, list);
  }

  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const startWeekday = firstOfMonth.getUTCDay();

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  function goToPreviousMonth() {
    setHovered(null);
    if (monthIndex === 0) {
      setYear((current) => current - 1);
      setMonthIndex(11);
    } else {
      setMonthIndex((current) => current - 1);
    }
  }

  function goToNextMonth() {
    setHovered(null);
    if (monthIndex === 11) {
      setYear((current) => current + 1);
      setMonthIndex(0);
    } else {
      setMonthIndex((current) => current + 1);
    }
  }

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button type="button" className="calendar-nav" onClick={goToPreviousMonth} aria-label="Previous month">
          &larr;
        </button>
        <span className="calendar-title">
          {MONTH_NAMES[monthIndex]} {year}
        </span>
        <button type="button" className="calendar-nav" onClick={goToNextMonth} aria-label="Next month">
          &rarr;
        </button>
      </div>

      <div className="calendar-grid calendar-weekdays">
        {WEEKDAY_NAMES.map((weekday) => (
          <div key={weekday} className="calendar-weekday">
            {weekday}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} className="calendar-cell empty" />;

          const dateKey = isoDate(year, monthIndex, day);
          const entries = entriesByDate.get(dateKey) || [];
          const hasConfirmed = entries.some((entry) => entry.status === "confirmed");
          const hasPending = entries.some((entry) => entry.status === "pending");
          const isHovered = hovered === dateKey;

          return (
            <div
              key={dateKey}
              className={[
                "calendar-cell",
                hasConfirmed ? "confirmed" : "",
                !hasConfirmed && hasPending ? "pending" : "",
              ].join(" ").trim()}
              onMouseEnter={() => entries.length > 0 && setHovered(dateKey)}
              onMouseLeave={() => setHovered((current) => (current === dateKey ? null : current))}
            >
              <span className="calendar-day-number">{day}</span>
              {isHovered && entries.length > 0 && (
                <div className="calendar-tooltip">
                  {entries.map((entry) => (
                    <div key={`${entry.orgName}-${entry.status}`} className="calendar-tooltip-row">
                      <span className={`status-dot ${entry.status}`} />
                      {entry.orgName} &mdash; {entry.status}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="calendar-legend">
        <span>
          <span className="status-dot confirmed" /> Confirmed
        </span>
        <span>
          <span className="status-dot pending" /> Pending
        </span>
      </div>
    </div>
  );
}
