const fs = require('fs')

function addTranslations(lang, data) {
  const file = `src/i18n/dictionaries/${lang}.json`
  const dict = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!dict.admin) dict.admin = {}
  if (!dict.admin.accreditations) dict.admin.accreditations = {}

  dict.admin.accreditations = { ...dict.admin.accreditations, ...data }
  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + '\n')
}

addTranslations('en', {
  "whatIsHeading": "What are Accreditations?",
  "whatIsDescription": "Journalists use the Press Portal to request accreditation for upcoming events or concerts. Here, you can review their requests, add an optional internal note, and approve or reject them.",
  "internalNote": "Admin note (internal only)",
  "approve": "Approve",
  "reject": "Reject",
  "approved": "Approved",
  "rejected": "Rejected",
  "pending": "Pending",
  "noRequests": "No accreditation requests yet.",
  "loadError": "Failed to load accreditation requests",
  "updateError": "Failed to update request",
  "updateSuccess": "Request {status}"
})

addTranslations('de', {
  "whatIsHeading": "Was sind Akkreditierungen?",
  "whatIsDescription": "Journalisten nutzen das Presseportal, um eine Akkreditierung für anstehende Events oder Konzerte anzufragen. Hier kannst du die Anfragen prüfen, eine optionale interne Notiz hinzufügen und sie genehmigen oder ablehnen.",
  "internalNote": "Admin-Notiz (nur intern)",
  "approve": "Genehmigen",
  "reject": "Ablehnen",
  "approved": "Genehmigt",
  "rejected": "Abgelehnt",
  "pending": "Ausstehend",
  "noRequests": "Noch keine Akkreditierungsanfragen.",
  "loadError": "Akkreditierungsanfragen konnten nicht geladen werden",
  "updateError": "Anfrage konnte nicht aktualisiert werden",
  "updateSuccess": "Anfrage {status}"
})

console.log("Translations added")
