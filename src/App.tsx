import { useCallback, useEffect, useRef, useState } from 'react';
import { AppProvider } from './lib/app';
import { createRepo, type Repo } from './lib/repo';
import { match, useLocation } from './lib/router';
import type { Profile } from './lib/types';
import { Loading, TabBar } from './components/ui';
import { Auth } from './pages/Auth';
import { Today } from './pages/client/Today';
import { DayView } from './pages/client/DayView';
import { WorkoutLive } from './pages/client/WorkoutLive';
import { WorkoutDone } from './pages/client/WorkoutDone';
import { Routines } from './pages/Routines';
import { RoutineEditor } from './pages/RoutineEditor';
import { Progress, ExerciseProgress } from './pages/Progress';
import { Catalog } from './pages/Catalog';
import { ProfilePage } from './pages/Profile';
import { Clients } from './pages/trainer/Clients';
import { ClientDetail } from './pages/trainer/ClientDetail';

export function App() {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [me, setMe] = useState<Profile | null | undefined>(undefined);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timer = useRef<number>();

  useEffect(() => {
    let off: (() => void) | undefined;
    createRepo().then((r) => {
      setRepo(r);
      off = r.onAuth(setMe);
    });
    return () => off?.();
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  if (!repo || me === undefined) return <Loading />;
  if (!me) return <Auth repo={repo} />;

  return (
    <AppProvider value={{ repo, me, setMe, toast }}>
      <Routes role={me.role} />
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppProvider>
  );
}

function Routes({ role }: { role: Profile['role'] }) {
  const { path, query } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  let p: Record<string, string> | null;
  let page: JSX.Element | null = null;
  let tabs = true;

  if ((p = match('/routine/:clientId/:routineId', path))) { page = <RoutineEditor clientId={p.clientId} routineId={p.routineId} />; tabs = false; }
  else if ((p = match('/progress/:clientId/:exerciseId', path))) page = <ExerciseProgress clientId={p.clientId} exerciseId={p.exerciseId} />;
  else if (match('/catalog', path)) page = <Catalog />;
  else if (match('/profile', path)) page = <ProfilePage />;
  else if (role === 'trainer') {
    if ((p = match('/client/:id', path))) page = <ClientDetail clientId={p.id} tab={query.get('tab') ?? 'routine'} />;
    else page = <Clients />;
  } else {
    if ((p = match('/day/:routineId/:dayId', path))) page = <DayView routineId={p.routineId} dayId={p.dayId} />;
    else if (match('/workout', path)) { page = <WorkoutLive />; tabs = false; }
    else if ((p = match('/done/:id', path))) { page = <WorkoutDone workoutId={p.id} />; tabs = false; }
    else if (match('/routines', path)) page = <Routines />;
    else if (match('/progress', path)) page = <Progress />;
    else page = <Today />;
  }

  return (
    <div className={tabs ? 'with-tabs' : ''}>
      {page}
      {tabs && <TabBar role={role} />}
    </div>
  );
}
