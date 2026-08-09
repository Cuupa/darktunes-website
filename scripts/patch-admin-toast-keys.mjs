import fs from 'node:fs'

for (const loc of ['en', 'de']) {
  const p = `src/i18n/messages/${loc}/admin.json`
  const j = JSON.parse(fs.readFileSync(p, 'utf8'))
  j.toast = j.toast || {}
  if (loc === 'de') {
    j.toast.genre_added = 'Genre „{name}“ hinzugefügt.'
    j.toast.confirm_delete_genre =
      'Genre „{name}“ löschen? Künstler behalten es in bestehenden Daten.'
    j.toast.sync_queue_finished =
      'Sync-Queue fertig. Admin-Liste neu geladen und öffentlicher Cache revalidiert.'
    j.toast.sync_still_running =
      'Sync läuft noch im Hintergrund ({count} Job(s) übrig). Liste mit aktuellen Daten neu geladen.'
    j.toast.sync_completed_with_errors =
      'Sync mit {errors} Fehler(n) abgeschlossen. {synced} Element(e) synchronisiert.'
  } else {
    j.toast.genre_added = 'Genre "{name}" added.'
    j.toast.confirm_delete_genre =
      'Delete genre "{name}"? Artists using this genre will keep it in their existing data.'
    j.toast.sync_queue_finished =
      'Sync queue finished. Admin list reloaded and public cache revalidated.'
    j.toast.sync_still_running =
      'Sync still running in the background ({count} job(s) left). List reloaded with current data.'
    j.toast.sync_completed_with_errors =
      'Sync completed with {errors} error(s). {synced} item(s) synced.'
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n')
}
console.log('patched admin toast keys')
