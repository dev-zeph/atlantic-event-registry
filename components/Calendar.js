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

export default function Calendar({ dates, initialYear, initialMonth, mySlug, window: bookable }) {
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

  const viewingBookableMonth =
    !bookable || (bookable.year === year && bookable.monthIndex === monthIndex);

  function step(delta) {
    setHovered(null);
    const next = monthIndex + delta;
    if (next < 0) {
      setYear((current) => current - 1);
      setMonthIndex(11);
    } else if (next > 11) {
      setYear((current) => current + 1);
      setMonthIndex(0);
    } else {
      setMonthIndex(next);
    }
  }

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button type="button" className="calendar-nav" onClick={() => step(-1)} aria-label="Previous month">
          &#8592;
        </button>
        <span className="calendar-title">
          {MONTH_NAMES[monthIndex]} {year}
        </span>
        <button type="button" className="calendar-nav" onClick={() => step(1)} aria-label="Next month">
          &#8594;
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAY_NAMES.map((weekday) => (
          <div key={weekday} className="calendar-weekday">
            {weekday}
          </div>
        ))}

        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} className="calendar-cell is-blank" />;

          const dateKey = isoDate(year, monthIndex, day);
          const entries = entriesByDate.get(dateKey) || [];
          const hasConfirmed = entries.some((entry) => entry.status === "confirmed");
          const hasPending = entries.some((entry) => entry.status === "pending");
          const isMine = Boolean(mySlug) && entries.some((entry) => entry.orgSlug === mySlug);
          const isHovered = hovered === dateKey;
          const isBookable =
            !bookable || (dateKey >= bookable.first && dateKey <= bookable.last);

          const classes = ["calendar-cell"];
          if (hasConfirmed) classes.push("is-confirmed");
          else if (hasPending) classes.push("is-pending");
          if (isMine) classes.push("is-mine");
          if (!isBookable) classes.push("is-outside");

          return (
            <div
              key={dateKey}
              className={classes.join(" ")}
              onMouseEnter={() => entries.length > 0 && setHovered(dateKey)}
              onMouseLeave={() => setHovered((current) => (current === dateKey ? null : current))}
            >
              <span className="calendar-day">{day}</span>
              {isHovered && entries.length > 0 && (
                <div className="calendar-tooltip">
                  {entries.map((entry) => (
                    <div key={`${entry.orgSlug}-${entry.status}`} className="calendar-tooltip-row">
                      <span className={`dot dot-${entry.status}`} />
                      {entry.orgName} ({entry.status})
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {bookable && !viewingBookableMonth && (
        <p className="calendar-notice">
          Outside the test window. Only {MONTH_NAMES[bookable.monthIndex]} {bookable.year} dates
          can be booked right now.
        </p>
      )}

      <div className="calendar-legend">
        <span>
          <span className="dot dot-confirmed" /> Confirmed
        </span>
        <span>
          <span className="dot dot-pending" /> Pending
        </span>
      </div>
    </div>
  );
}
