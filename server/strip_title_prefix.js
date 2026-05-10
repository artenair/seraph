#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../server/.env') });

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null;
const credential     = serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault();
admin.initializeApp({ credential, databaseURL: process.env.FIREBASE_DATABASE_URL, projectId: process.env.FIREBASE_PROJECT_ID });

const roomId = process.argv[2];
const PREFIX = process.argv[3];
if (!roomId || !PREFIX) { console.error('Usage: node strip_title_prefix.js <roomId> <prefix>'); process.exit(1); }

const snap = await admin.firestore().collection(`rooms/${roomId}/songs`).get();
console.log('Sample titles:');
snap.docs.slice(0, 5).forEach(d => console.log(' ', JSON.stringify(d.data().title)));
let count = 0;
for (const doc of snap.docs) {
  const title = doc.data().title ?? '';
  if (title.startsWith(PREFIX)) {
    const newTitle = title.slice(PREFIX.length);
    await doc.ref.update({ title: newTitle });
    console.log(`  "${title}" → "${newTitle}"`);
    count++;
  }
}
console.log(`\nDone. Updated ${count} song(s).`);
