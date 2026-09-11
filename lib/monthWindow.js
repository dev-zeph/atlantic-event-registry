// During the test period only the current calendar month can be booked.
// Everything outside it is shown greyed out and rejected server-side.
//
// Note: the server computes this in UTC and the browser in local time, so on
// the very first or last day of a month they can briefly disagree. The server
// is the authority and returns a clear error if it does. Not worth building
// timezone plumbing for a throwaway demo.

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function monthWindowFrom(year, monthIndex) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    year,
    monthIndex,
    first: `${year}-${pad2(monthIndex + 1)}-01`,
    last: `${year}-${pad2(monthIndex + 1)}-${pad2(lastDay)}`,
  };
}

// Browser: uses the viewer's local month.
export function localMonthWindow(now = new Date()) {
  return monthWindowFrom(now.getFullYear(), now.getMonth());
}

// Server: uses UTC.
export function utcMonthWindow(now = new Date()) {
  return monthWindowFrom(now.getUTCFullYear(), now.getUTCMonth());
}

export function isWithinWindow(isoDate, window) {
  return isoDate >= window.first && isoDate <= window.last;
}

export function monthLabel(window) {
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${names[window.monthIndex]} ${window.year}`;
}
