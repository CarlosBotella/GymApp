import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './lib/app';
import { createStore, savedMode, type Store } from './lib/db';
import { go, useRoute } from './lib/router';
import { Loading, ToastHost } from './ui/kit';
import { CompleteProfile, Install, Join, Login, Signup, Welcome } from './screens/auth';
import { Today } from './screens/client/today';
import { LiveWorkout } from './screens/client/workout';
import { Summary } from './screens/client/summary';
import { RoutineEdit, RoutineView, Routines } from './screens/client/routines';
import { Evolution, Progress } from './screens/client/progress';
import { VisbodyImport } from './screens/client/visbody';
import { Export } from './screens/client/export';
import { ExerciseSheet, MachineScreen } from './screens/exercise';
import { Settings } from './screens/settings';
import { Clients } from './screens/trainer/clients';
import { Invite } from './screens/trainer/invite';
import { Library } from './screens/trainer/library';
import { Write } from './screens/trainer/write';
import { Suggest } from './screens/trainer/suggest';
import { NextWeek } from './screens/trainer/nextweek';
import { ClientDetail } from './screens/trainer/client';
import { Exercises } from './screens/trainer/exercises';
import { Report } from './screens/report';

export function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    createStore(savedMode())
      .then(setStore)
      .catch((e) => {
        console.error(e);
        setError('No se ha podido conectar con la base de datos. Prueba el modo demo o revisa la conexión.');
      });
  }, []);
  if (error)
    return (
      <div className="screen">
        <div className="main" style={{ justifyContent: 'center' }}>
          <p className="lead">{error}</p>
        </div>
      </div>
    );
  if (!store) return <Loading />;
  return (
    <AppProvider store={store}>
      <Routes />
      <ToastHost />
    </AppProvider>
  );
}

const PUBLIC = ['bienvenida', 'entrar', 'registro', 'unirse', 'instalar'];

function Routes() {
  const { auth, authReady, profile, profileReady } = useApp();
  const r = useRoute();
  const [a, b] = r.parts;

  useEffect(() => {
    if (!authReady) return;
    if (!auth) {
      if (!PUBLIC.includes(a || '')) go('/bienvenida', true);
      return;
    }
    if (!profileReady) return;
    if (!profile) {
      if (a !== 'registro' && a !== 'unirse') go('/registro?paso=perfil', true);
      return;
    }
    if (!a || a === 'bienvenida' || a === 'entrar' || (a === 'registro' && !r.params.get('invite'))) go(profile.role === 'trainer' ? '/clientes' : '/hoy', true);
  }, [auth, authReady, profile, profileReady, a, r.params]);

  if (!authReady || (auth && !profileReady)) return <Loading />;

  if (!auth || !profile) {
    if (a === 'entrar') return <Login />;
    if (a === 'registro') return auth ? <CompleteProfile invite={r.params.get('invite')} /> : <Signup role={(r.params.get('rol') as 'client' | 'trainer') || 'client'} invite={r.params.get('invite')} />;
    if (a === 'unirse') return auth ? <CompleteProfile invite={b || null} /> : <Signup role="client" invite={b || null} />;
    if (a === 'instalar') return <Install />;
    return <Welcome />;
  }

  const trainer = profile.role === 'trainer';
  switch (a) {
    case 'unirse':
      return <Join code={b || ''} />;
    case 'instalar':
      return <Install />;
    case 'ajustes':
      return <Settings />;
    case 'informe':
      return <Report clientId={b || profile.id} />;
    case 'ejercicio':
      return <ExerciseSheet id={b || ''} />;
    case 'maquina':
      return <MachineScreen id={b || ''} />;
    case 'exportar':
      return <Export clientId={b || profile.id} />;
  }
  if (trainer) {
    switch (a) {
      case 'invitar':
        return <Invite />;
      case 'biblioteca':
        return <Library forClient={r.params.get('para')} />;
      case 'escribir':
        return <Write forClient={r.params.get('para')} routineId={r.params.get('rutina')} />;
      case 'sugerir':
        return <Suggest routineId={b || ''} />;
      case 'semana':
        return <NextWeek routineId={b || ''} />;
      case 'cliente':
        return <ClientDetail clientId={b || ''} />;
      case 'ejercicios':
        return <Exercises />;
      default:
        return <Clients />;
    }
  }
  switch (a) {
    case 'entreno':
      return <LiveWorkout />;
    case 'resumen':
      return <Summary workoutId={b || ''} />;
    case 'rutinas':
      return <Routines />;
    case 'rutina':
      if (b === 'nueva') return <RoutineEdit routineId={null} />;
      if (r.parts[2] === 'editar') return <RoutineEdit routineId={b || null} />;
      return <RoutineView routineId={b || ''} />;
    case 'progreso':
      return <Progress />;
    case 'evolucion':
      return <Evolution />;
    case 'visbody':
      return <VisbodyImport />;
    default:
      return <Today />;
  }
}
