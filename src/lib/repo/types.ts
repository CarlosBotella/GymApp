import type { CenterId, Profile, Role, Routine, Workout } from '../types';

export type ProfilePatch = Partial<Pick<Profile, 'name' | 'center' | 'exerciseNotes'>>;

/** Todo el acceso a datos pasa por aquí: modo demo (localStorage) o Firebase. */
export interface Repo {
  mode: 'demo' | 'firebase';
  /** Escucha cambios de sesión. Devuelve la función para dejar de escuchar. */
  onAuth(cb: (me: Profile | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(input: { email: string; password: string; name: string; role: Role; center: CenterId }): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;

  updateMe(patch: ProfilePatch): Promise<Profile>;
  joinTrainer(code: string): Promise<Profile>;
  leaveTrainer(): Promise<Profile>;
  getProfile(id: string): Promise<Profile | null>;
  listClients(): Promise<Profile[]>;

  listRoutines(clientId: string): Promise<Routine[]>;
  saveRoutine(r: Routine): Promise<void>;
  deleteRoutine(r: Routine): Promise<void>;

  listWorkouts(clientId: string): Promise<Workout[]>;
  saveWorkout(w: Workout): Promise<void>;
  deleteWorkout(w: Workout): Promise<void>;
  commentWorkout(w: Workout, comment: string): Promise<void>;
}
