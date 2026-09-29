import './style.css';
import { api, ApiError, type Reservation } from './api';
import { formatDate, formatSlot, versionHue } from './format';

const form = document.querySelector<HTMLFormElement>('#reservation-form')!;
const formMessage = document.querySelector<HTMLParagraphElement>('#form-message')!;
const listMessage = document.querySelector<HTMLParagraphElement>('#list-message')!;
const tbody = document.querySelector<HTMLTableSectionElement>('#reservations-body')!;
const roomSelect = document.querySelector<HTMLSelectElement>('#room-select')!;
const showCancelled = document.querySelector<HTMLInputElement>('#show-cancelled')!;

let reservations: Reservation[] = [];

function setMessage(el: HTMLElement, text: string, kind: 'success' | 'error' | '' = '') {
  el.textContent = text;
  el.className = `message ${kind}`;
}

async function loadVersions() {
  const banner = document.querySelector<HTMLDivElement>('#version-banner')!;
  const [front, back] = await Promise.allSettled([api.frontendConfig(), api.apiVersion()]);
  const frontVersion = front.status === 'fulfilled' ? front.value.version : 'inconnue';
  const apiVersion = back.status === 'fulfilled' ? `${back.value.version} (${back.value.commit})` : 'indisponible';

  document.querySelector('#frontend-version')!.textContent = frontVersion;
  document.querySelector('#api-version')!.textContent = apiVersion;
  document.title = `Réservations — v${frontVersion}`;
  banner.style.setProperty('--hue', String(versionHue(frontVersion)));
}

async function loadRooms() {
  const rooms = await api.listRooms();
  roomSelect.replaceChildren(
    ...rooms.map(({ name, capacity }) => new Option(`${name} (${capacity} places)`, name)),
  );
}

function renderReservations() {
  const visible = showCancelled.checked ? reservations : reservations.filter((r) => r.status === 'confirmed');
  if (visible.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Aucune réservation.</td></tr>';
    return;
  }
  tbody.replaceChildren(
    ...visible.map((r) => {
      const row = document.createElement('tr');
      row.classList.toggle('cancelled', r.status === 'cancelled');
      const cells = [formatDate(r.date), formatSlot(r.startTime, r.endTime), r.room, r.customerName, String(r.participants)];
      for (const text of cells) {
        const td = document.createElement('td');
        td.textContent = text;
        row.append(td);
      }

      const status = document.createElement('td');
      status.innerHTML = `<span class="badge ${r.status}">${r.status === 'confirmed' ? 'Confirmée' : 'Annulée'}</span>`;
      row.append(status);

      const actions = document.createElement('td');
      if (r.status === 'confirmed') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary';
        button.textContent = 'Annuler';
        button.addEventListener('click', () => cancelReservation(r));
        actions.append(button);
      }
      row.append(actions);
      return row;
    }),
  );
}

async function loadReservations() {
  try {
    reservations = await api.listReservations();
    setMessage(listMessage, '');
    renderReservations();
  } catch {
    setMessage(listMessage, "Impossible de charger les réservations : l'API est-elle démarrée ?", 'error');
  }
}

async function cancelReservation(r: Reservation) {
  if (!confirm(`Annuler la réservation de ${r.customerName} (${r.room}, ${formatDate(r.date)}) ?`)) return;
  try {
    await api.cancelReservation(r.id);
    setMessage(listMessage, 'Réservation annulée.', 'success');
    await loadReservations();
  } catch (err) {
    setMessage(listMessage, err instanceof ApiError ? err.message : 'Erreur inattendue.', 'error');
  }
}

function showFieldErrors(details: Record<string, string>) {
  form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => {
    el.textContent = details[el.dataset.errorFor!] ?? '';
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  showFieldErrors({});
  try {
    await api.createReservation({
      customerName: String(data.get('customerName') ?? ''),
      email: String(data.get('email') ?? ''),
      room: String(data.get('room') ?? ''),
      date: String(data.get('date') ?? ''),
      startTime: String(data.get('startTime') ?? ''),
      endTime: String(data.get('endTime') ?? ''),
      participants: Number(data.get('participants')),
    });
    form.reset();
    setMessage(formMessage, 'Réservation créée.', 'success');
    await loadReservations();
  } catch (err) {
    if (err instanceof ApiError) {
      showFieldErrors(err.details);
      setMessage(formMessage, err.message, 'error');
    } else {
      setMessage(formMessage, 'Erreur inattendue.', 'error');
    }
  }
});

showCancelled.addEventListener('change', renderReservations);

loadVersions();
loadRooms().catch(() => setMessage(formMessage, 'Impossible de charger les salles.', 'error'));
loadReservations();
