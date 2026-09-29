const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatSlot(startTime: string, endTime: string): string {
  return `${startTime} – ${endTime}`;
}

// Teinte stable dérivée de la version : une nouvelle version change la couleur du bandeau
export function versionHue(version: string): number {
  let hash = 0;
  for (const char of version) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % 360;
}
