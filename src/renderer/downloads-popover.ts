import './styles/tailwind.css';
import type { DownloadSnapshot, DownloadsPopoverInitPayload } from '../shared/ipc-contract';

const downloadsList = document.getElementById('downloads-list') as HTMLDivElement;
const downloadsEmpty = document.getElementById('downloads-empty') as HTMLDivElement;
const btnOpenDownloads = document.getElementById('btn-open-downloads') as HTMLButtonElement;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const decimals = unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

const STATE_DOT_COLOR: Record<string, string> = {
  progressing: 'var(--orb-accent)',
  paused:      'var(--orb-yellow)',
  completed:   'var(--orb-green)',
  cancelled:   'var(--orb-red)',
  interrupted: 'var(--orb-red)',
};

const ACTION_BTN =
  'padding:3px 8px;border-radius:4px;border:1px solid var(--orb-border);' +
  'background:var(--orb-surface);font-family:ui-monospace,monospace;font-size:9px;' +
  'letter-spacing:0.06em;color:var(--orb-text-dim);cursor:pointer;' +
  'transition:background 100ms,border-color 100ms,color 100ms;';

function renderDownloads(downloads: DownloadSnapshot[]): void {
  downloadsList.innerHTML = '';
  downloadsEmpty.classList.toggle('hidden', downloads.length > 0);

  downloads.slice(0, 6).forEach(download => {
    const item = document.createElement('div');
    const isActive = download.state === 'progressing' || download.state === 'paused';
    const isCompleted = download.state === 'completed';
    const progressPercent = Math.max(0, Math.min(100, download.percent));
    const totalBytesText = download.totalBytes > 0 ? formatBytes(download.totalBytes) : 'unknown';
    const dotColor = STATE_DOT_COLOR[download.state] ?? 'var(--orb-text-dim)';
    const id = escapeHtml(download.id);

    item.className =
      'mb-1 rounded-orb border border-orb-border bg-orb-bg px-2.5 py-2 last:mb-0 transition hover:border-orb-border-hi';

    const progressMarkup = isActive
      ? `<div class="mt-1.5 h-[3px] overflow-hidden rounded-full bg-orb-surface-2">
           <div class="orb-progress-fill" style="width:${progressPercent}%"></div>
         </div>
         <div class="mt-1 font-mono text-[10px] text-orb-text-dim">${escapeHtml(formatBytes(download.receivedBytes))} / ${escapeHtml(totalBytesText)}</div>`
      : '';

    let actionsMarkup = '';
    if (isCompleted) {
      actionsMarkup = `
        <div class="mt-1.5 flex gap-1">
          <button data-popover-open-id="${id}" style="${ACTION_BTN}">open</button>
          <button data-popover-show-id="${id}" style="${ACTION_BTN}">show in folder</button>
        </div>`;
    } else if (isActive) {
      const pauseBtn = download.state === 'progressing'
        ? `<button data-popover-pause-id="${id}" style="${ACTION_BTN}">pause</button>`
        : '';
      const resumeBtn = download.state === 'paused' && download.canResume
        ? `<button data-popover-resume-id="${id}" style="${ACTION_BTN}">resume</button>`
        : '';
      actionsMarkup = `
        <div class="mt-1.5 flex gap-1">
          ${pauseBtn}
          ${resumeBtn}
          <button data-popover-cancel-id="${id}" style="${ACTION_BTN}">cancel</button>
        </div>`;
    }

    item.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-orb-text">${escapeHtml(download.fileName)}</span>
        <span style="width:6px;height:6px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>
      </div>
      ${progressMarkup}
      ${actionsMarkup}
    `;

    downloadsList.appendChild(item);
  });
}

// Event delegation for action buttons
downloadsList.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const openId = target.closest<HTMLElement>('[data-popover-open-id]')?.getAttribute('data-popover-open-id');
  if (openId) { void window.orb.openDownloadFile(openId); return; }

  const showId = target.closest<HTMLElement>('[data-popover-show-id]')?.getAttribute('data-popover-show-id');
  if (showId) { void window.orb.showDownloadInFolder(showId); return; }

  const pauseId = target.closest<HTMLElement>('[data-popover-pause-id]')?.getAttribute('data-popover-pause-id');
  if (pauseId) { void window.orb.pauseDownload(pauseId); return; }

  const resumeId = target.closest<HTMLElement>('[data-popover-resume-id]')?.getAttribute('data-popover-resume-id');
  if (resumeId) { void window.orb.resumeDownload(resumeId); return; }

  const cancelId = target.closest<HTMLElement>('[data-popover-cancel-id]')?.getAttribute('data-popover-cancel-id');
  if (cancelId) { void window.orb.cancelDownload(cancelId); }
});

window.orb.onDownloadsPopoverInit((payload: DownloadsPopoverInitPayload) => {
  document.documentElement.dataset.theme = payload.theme;
  renderDownloads(payload.downloads);
});

btnOpenDownloads.addEventListener('click', () => {
  void window.orb.openDownloadsPageFromPopover();
});
