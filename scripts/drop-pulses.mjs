/**
 * One-off cleanup: strips the retired per-pulse fields from Firestore.
 *
 * Sessions are priced as whole sessions now, so `pulses` and `price_per_pulse`
 * mean nothing on a reservation, and `price_per_pulse` means nothing on a
 * service. Nothing in the app reads them any more — this deletes them so the
 * documents match the model.
 *
 * Money is left alone: `price_at_booking` on a closed session is what the
 * client was actually charged, and it stays exactly as it is.
 *
 * Run it once, from the project root:
 *
 *   npm i -D firebase-admin
 *   # a service-account key for the reem-emam project:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   node scripts/drop-pulses.mjs --dry     # count what would change
 *   node scripts/drop-pulses.mjs           # actually write
 *
 * It runs through the admin SDK, so Firestore rules don't apply and no client
 * account needs write access to fields the app no longer sends.
 */
import { cert, initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const dryRun = process.argv.includes('--dry')
const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS

initializeApp({
  credential: keyFile
    ? cert(JSON.parse(readFileSync(keyFile, 'utf8')))
    : applicationDefault(),
})

const db = getFirestore()

/** Firestore caps a batch at 500 writes, so the deletes go out in chunks. */
const BATCH_LIMIT = 400

async function stripFields(collectionName, fields) {
  const snap = await db.collection(collectionName).get()
  const targets = snap.docs.filter(d => fields.some(f => d.get(f) !== undefined))

  console.log(
    `${collectionName}: ${targets.length} من ${snap.size} فيهم ${fields.join(' / ')}`
  )
  if (dryRun || targets.length === 0) return targets.length

  for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    for (const doc of targets.slice(i, i + BATCH_LIMIT)) {
      batch.update(doc.ref, Object.fromEntries(fields.map(f => [f, FieldValue.delete()])))
    }
    await batch.commit()
    console.log(`  اتكتب ${Math.min(i + BATCH_LIMIT, targets.length)} / ${targets.length}`)
  }
  return targets.length
}

const reservations = await stripFields('reservations', ['pulses', 'price_per_pulse'])
const services = await stripFields('services', ['price_per_pulse'])

console.log(
  dryRun
    ? `\n(تجربة بس — مفيش حاجة اتكتبت) هيتمسح من ${reservations} حجز و${services} خدمة`
    : `\nتم — اتمسحت من ${reservations} حجز و${services} خدمة`
)
process.exit(0)
