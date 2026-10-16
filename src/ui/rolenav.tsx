import { useMe } from '../lib/app';
import { ClientNav, TrainerNav } from './kit';

/** Barra de abajo según quién usa la app; para pantallas compartidas (ficha, ajustes…). */
export function RoleNav({ client = 'hoy', trainer = 'clientes', compact }: { client?: 'hoy' | 'rutinas' | 'progreso'; trainer?: 'clientes' | 'rutinas' | 'ejercicios'; compact?: boolean }) {
  const me = useMe();
  return me.role === 'trainer' ? <TrainerNav active={trainer} /> : <ClientNav active={client} compact={compact} />;
}
