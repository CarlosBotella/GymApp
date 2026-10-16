import type { Store } from './db';
import type { BodyReport, Invite, Note, Profile, Routine, Suggestion } from './types';
import { WEEK, code6, uid } from './util';

// Operaciones de dominio que combinan varias escrituras.

export async function createProfile(store: Store, id: string, name: string, email: string | null, role: Profile['role']) {
  const p: Profile = { id, name, email: email || undefined, role, trainerId: null, shareBody: true, createdAt: Date.now() };
  await store.set('users', id, p);
  return p;
}

export async function createInvite(store: Store, me: Profile, clientName: string, days: number): Promise<Invite> {
  const inv: Invite = {
    id: code6(),
    trainerId: me.id,
    trainerName: me.name,
    clientName,
    days,
    createdAt: Date.now(),
    expiresAt: Date.now() + WEEK,
    usedBy: null,
  };
  await store.set('invites', inv.id, inv);
  return inv;
}

export async function acceptInvite(store: Store, me: Profile, inv: Invite, shareBody: boolean) {
  await store.update('users', me.id, {
    trainerId: inv.trainerId,
    trainerName: inv.trainerName,
    linkedAt: Date.now(),
    shareBody,
    days: inv.days || me.days || 3,
  });
  await store.update('invites', inv.id, { usedBy: me.id });
  await retagClientData(store, me.id, inv.trainerId, shareBody);
}

/** Al vincular, desvincular o cambiar qué se comparte, se actualiza trainerId en los datos del cliente */
export async function retagClientData(store: Store, clientId: string, trainerId: string | null, shareBody: boolean) {
  const [ws, rs, bs] = await Promise.all([
    store.query<{ id: string }>('workouts', [['clientId', clientId]]),
    store.query<Routine>('routines', [['ownerId', clientId]]),
    store.query<BodyReport>('bodyReports', [['clientId', clientId]]),
  ]);
  await Promise.all([
    ...ws.map((w) => store.update('workouts', w.id, { trainerId })),
    ...rs.map((r) => store.update('routines', r.id, { trainerId })),
    ...bs.map((b) => store.update('bodyReports', b.id, { trainerId: shareBody ? trainerId : null })),
  ]);
}

export async function unlinkTrainer(store: Store, me: Profile) {
  await store.update('users', me.id, { trainerId: null, trainerName: null, linkedAt: null });
  await retagClientData(store, me.id, null, false);
}

export async function setShareBody(store: Store, me: Profile, share: boolean) {
  await store.update('users', me.id, { shareBody: share });
  const bs = await store.query<BodyReport>('bodyReports', [['clientId', me.id]]);
  await Promise.all(bs.map((b) => store.update('bodyReports', b.id, { trainerId: share ? me.trainerId || null : null })));
}

/** Copia una rutina de la biblioteca y se la asigna al cliente */
export async function assignRoutine(store: Store, trainer: Profile, template: Routine, clientId: string, dayOrder?: string[]): Promise<Routine> {
  const existing = await store.query<Routine>('routines', [['clientId', clientId], ['ownerId', trainer.id]]);
  await Promise.all(existing.filter((r) => !r.template).map((r) => store.remove('routines', r.id)));
  const now = Date.now();
  const days = template.days.map((d) => ({ ...d, id: uid(8), exercises: d.exercises.map((p) => ({ ...p, id: uid(8) })) }));
  if (dayOrder) days.sort((a, b) => dayOrder.indexOf(a.name) - dayOrder.indexOf(b.name));
  const r: Routine = {
    ...template,
    id: uid(),
    ownerId: trainer.id,
    ownerRole: 'trainer',
    clientId,
    trainerId: trainer.id,
    template: false,
    week: 1,
    days,
    createdAt: now,
    updatedAt: now,
    basedOn: template.id,
  };
  await store.set('routines', r.id, r);
  if (template.template) await store.update('routines', template.id, { uses: (template.uses || 0) + 1, updatedAt: now });
  return r;
}

export async function answerSuggestion(store: Store, s: Suggestion, status: Suggestion['status'], routine: Routine | null) {
  await store.update('suggestions', s.id, { status, answeredAt: Date.now() });
  if (status === 'accepted' && routine) {
    const days = routine.days.map((d) =>
      d.id !== s.dayId ? d : { ...d, exercises: d.exercises.map((p) => (p.id === s.planId ? { ...p, exerciseId: s.toExerciseId, rawName: undefined } : p)) },
    );
    await store.update('routines', routine.id, { days, updatedAt: Date.now() });
  }
}

export async function addNote(store: Store, me: Profile, text: string, kind: Note['kind'], extra: Partial<Note> = {}) {
  if (!me.trainerId) return;
  const n: Note = {
    id: uid(),
    clientId: me.id,
    trainerId: me.trainerId,
    clientName: me.name,
    kind,
    text,
    createdAt: Date.now(),
    seen: false,
    ...extra,
  };
  await store.set('notes', n.id, n);
}

export async function deleteAccountData(store: Store, me: Profile) {
  const cols: [string, string][] = [
    ['workouts', 'clientId'],
    ['routines', 'ownerId'],
    ['bodyReports', 'clientId'],
    ['notes', 'clientId'],
    ['suggestions', me.role === 'trainer' ? 'trainerId' : 'clientId'],
  ];
  for (const [col, field] of cols) {
    const rows = await store.query<{ id: string }>(col, [[field, me.id]]);
    await Promise.all(rows.map((r) => store.remove(col, r.id)));
  }
  if (me.role === 'trainer') {
    const inv = await store.query<{ id: string }>('invites', [['trainerId', me.id]]);
    await Promise.all(inv.map((r) => store.remove('invites', r.id)));
  }
  await store.remove(`users/${me.id}/private`, 'machines');
  await store.remove('users', me.id);
}
