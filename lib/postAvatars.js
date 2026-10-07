import { writeBatch, deleteField } from 'firebase/firestore';
import { db } from './firebase';

// Los posts viejos (y los de versiones anteriores de la app) traen una copia del
// avatar en base64 que pesa cientos de KB en cada lectura. Se quita en segundo
// plano de los posts que se acaban de leer; el avatar real vive en el perfil.
// No toca updatedAt para no alterar el orden de la actividad.
export async function stripPostAvatars(postDocs) {
  try {
    const heavy = postDocs.filter(d => d.data().avatar !== undefined);
    for (let i = 0; i < heavy.length; i += 400) {
      const batch = writeBatch(db);
      heavy.slice(i, i + 400).forEach(d => batch.update(d.ref, { avatar: deleteField() }));
      await batch.commit();
    }
  } catch {}
}
