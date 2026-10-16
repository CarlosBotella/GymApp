import { attachAlternatives } from './alternatives';
import { buildFreeCatalog, MUSCLE_NAMES } from './free-exercises';
import { norm } from '../lib/util';
import type { DayGroup, Exercise, GroupId, Load } from '../lib/types';

// Catálogo genérico: no depende de un gimnasio concreto. Cada ejercicio trae
// apodos para reconocerlo al escribir, alternativas, tres claves de técnica y,
// en máquinas, tres rasgos para reconocerla.
// "ref" es un peso de trabajo típico de un usuario intermedio; sirve para
// proponer la carga equivalente al cambiar a una alternativa.

type K = Exercise['kind'];
function e(
  id: string,
  name: string,
  aliases: string[],
  group: GroupId,
  muscles: string,
  equipment: string,
  load: Load,
  ref: number,
  alts: string[],
  steps: [string, string, string],
  kind: K,
  look?: [string, string, string],
): Exercise {
  return { id, name, aliases, group, muscles, equipment, load, ref, alts, steps, kind, look };
}

export const ORIGINAL_EXERCISES: Exercise[] = [
  // ——— Pierna
  e('prensa', 'Prensa inclinada', ['prensa', 'prensa 45', 'leg press', 'prensa de piernas', 'prensa inclinada'], 'pierna', 'Cuádriceps y glúteo', 'Máquina de discos', 'plates', 120,
    ['sentadilla-bulgara', 'prensa-horizontal', 'sentadilla-goblet', 'sentadilla-hack'],
    ['Espalda pegada al respaldo, pies en el centro de la plataforma', 'Baja controlando hasta que las rodillas formen unos 90°', 'Empuja con los talones sin bloquear las rodillas arriba'], 'press45',
    ['Respaldo inclinado y asiento bajo', 'Plataforma grande en diagonal', 'Discos a los lados del carro']),
  e('prensa-horizontal', 'Prensa horizontal', ['prensa horizontal', 'prensa sentado'], 'pierna', 'Cuádriceps y glúteo', 'Máquina de placas', 'stack', 110,
    ['prensa', 'sentadilla-goblet', 'sentadilla-bulgara'],
    ['Ajusta el asiento para que las rodillas queden a 90°', 'Empuja la plataforma con todo el pie', 'Vuelve despacio sin despegar la zona lumbar'], 'machine',
    ['Asiento casi vertical', 'Plataforma delante, en vertical', 'Pila de placas con pasador']),
  e('sentadilla', 'Sentadilla con barra', ['sentadilla', 'squat', 'sentadilla barra'], 'pierna', 'Cuádriceps, glúteo y core', 'Barra', 'barbell', 70,
    ['sentadilla-hack', 'prensa', 'sentadilla-goblet'],
    ['Barra sobre los trapecios, pies a la anchura de hombros', 'Baja con el pecho alto hasta romper la paralela', 'Sube empujando el suelo, rodillas hacia fuera'], 'barbell'),
  e('sentadilla-hack', 'Sentadilla hack', ['hack', 'hack squat', 'sentadilla hack'], 'pierna', 'Cuádriceps', 'Máquina de discos', 'plates', 80,
    ['prensa', 'sentadilla', 'prensa-horizontal'],
    ['Hombros bajo las almohadillas, espalda apoyada', 'Baja hasta unos 90° sin despegar los talones', 'Sube sin bloquear las rodillas'], 'machine',
    ['Respaldo inclinado con almohadillas para hombros', 'Plataforma para los pies abajo', 'Se carga con discos']),
  e('sentadilla-bulgara', 'Sentadilla búlgara', ['bulgara', 'búlgara', 'sentadilla bulgara', 'split squat'], 'pierna', 'Cuádriceps y glúteo', 'Mancuernas y banco', 'dumbbell', 16,
    ['zancadas', 'sentadilla-goblet', 'prensa'],
    ['Pie de atrás apoyado en el banco, una mancuerna en cada mano', 'Baja en vertical hasta casi tocar el suelo con la rodilla', 'Sube empujando con el talón de delante'], 'dumbbell'),
  e('sentadilla-goblet', 'Sentadilla goblet', ['goblet', 'sentadilla goblet', 'copa'], 'pierna', 'Cuádriceps y glúteo', 'Una mancuerna', 'dumbbell', 28,
    ['sentadilla-bulgara', 'prensa', 'zancadas'],
    ['Sujeta la mancuerna en vertical pegada al pecho', 'Baja con los codos entre las rodillas', 'Sube manteniendo el pecho alto'], 'dumbbell'),
  e('zancadas', 'Zancadas', ['zancada', 'zancadas', 'lunges'], 'pierna', 'Cuádriceps y glúteo', 'Mancuernas', 'dumbbell', 14,
    ['sentadilla-bulgara', 'sentadilla-goblet'],
    ['Paso largo adelante con el tronco recto', 'Baja hasta que ambas rodillas formen 90°', 'Empuja con el pie de delante para volver'], 'dumbbell'),
  e('extension-cuadriceps', 'Extensión de cuádriceps', ['extension', 'extensiones', 'extension cuadriceps', 'cuadriceps', 'leg extension'], 'pierna', 'Cuádriceps', 'Máquina de placas', 'stack', 50,
    ['sentadilla-goblet', 'prensa-horizontal'],
    ['Rodilla alineada con el eje de la máquina', 'Extiende del todo y aprieta un segundo arriba', 'Baja despacio sin dejar caer el peso'], 'machine',
    ['Asiento con respaldo y rodillo en los tobillos', 'Se sube la pierna hacia delante', 'Pila de placas al lado']),
  e('curl-femoral-tumbado', 'Curl femoral tumbado', ['curl femoral', 'curl fem', 'femoral', 'femoral tumbado', 'curl femoral tumbado'], 'pierna', 'Femoral', 'Máquina de placas', 'stack', 40,
    ['curl-femoral-sentado', 'peso-muerto-rumano'],
    ['Túmbate boca abajo, rodillo justo encima de los talones', 'Flexiona hasta acercar los talones al glúteo', 'Baja controlando, sin despegar la cadera'], 'machine',
    ['Banco para tumbarse boca abajo', 'Rodillo en los tobillos', 'Pila de placas al final']),
  e('curl-femoral-sentado', 'Curl femoral sentado', ['curl femoral sentado', 'femoral sentado'], 'pierna', 'Femoral', 'Máquina de placas', 'stack', 45,
    ['curl-femoral-tumbado', 'peso-muerto-rumano'],
    ['Ajusta el rodillo superior sobre los muslos', 'Lleva los talones hacia abajo y atrás', 'Vuelve despacio hasta casi estirar'], 'machine',
    ['Asiento con rodillo encima de los muslos', 'Otro rodillo detrás de los tobillos', 'Pila de placas']),
  e('peso-muerto-rumano', 'Peso muerto rumano', ['rumano', 'peso muerto rumano', 'rdl'], 'pierna', 'Femoral y glúteo', 'Barra', 'barbell', 60,
    ['curl-femoral-tumbado', 'hip-thrust'],
    ['Barra pegada a los muslos, rodillas un poco flexionadas', 'Lleva la cadera atrás bajando la barra por las piernas', 'Sube apretando glúteo, espalda neutra todo el rato'], 'barbell'),
  e('hip-thrust', 'Hip thrust', ['hip thrust', 'empuje de cadera', 'puente'], 'pierna', 'Glúteo', 'Barra y banco', 'barbell', 80,
    ['peso-muerto-rumano', 'abductor'],
    ['Espalda alta en el banco, barra sobre la cadera', 'Sube la cadera hasta alinear rodillas, cadera y hombros', 'Aprieta un segundo arriba y baja controlando'], 'bench'),
  e('abductor', 'Abductor en máquina', ['abductor', 'abductores', 'abduccion'], 'pierna', 'Glúteo medio', 'Máquina de placas', 'stack', 45,
    ['hip-thrust'],
    ['Espalda apoyada, almohadillas por fuera de las rodillas', 'Abre las piernas hasta donde controles', 'Cierra despacio sin que choquen las placas'], 'machine',
    ['Asiento con almohadillas en las rodillas', 'Se empuja hacia fuera', 'Selector de apertura al lado']),
  e('aductor', 'Aductor en máquina', ['aductor', 'aductores', 'aduccion'], 'pierna', 'Aductores', 'Máquina de placas', 'stack', 45,
    ['sentadilla-goblet'],
    ['Almohadillas por dentro de las rodillas', 'Junta las piernas apretando', 'Abre despacio hasta un estiramiento cómodo'], 'machine',
    ['Asiento con almohadillas por dentro', 'Se empuja hacia dentro', 'Misma máquina que el abductor en muchos gimnasios']),
  e('gemelo-pie', 'Gemelo de pie', ['gemelo', 'gemelos', 'gemelo de pie', 'calf', 'pantorrilla'], 'pierna', 'Gemelo', 'Máquina de placas', 'stack', 60,
    ['gemelo-sentado', 'prensa'],
    ['Puntas en el borde, hombros bajo las almohadillas', 'Sube todo lo alto que puedas', 'Baja hasta estirar el talón por debajo del escalón'], 'machine',
    ['Almohadillas para los hombros', 'Escalón para las puntas', 'Pila de placas detrás']),
  e('gemelo-sentado', 'Gemelo sentado', ['gemelo sentado', 'soleo'], 'pierna', 'Sóleo', 'Máquina de discos', 'plates', 40,
    ['gemelo-pie'],
    ['Almohadilla sobre las rodillas, puntas en el escalón', 'Sube los talones todo lo posible', 'Baja lento hasta estirar'], 'machine',
    ['Asiento con almohadilla sobre las rodillas', 'Escalón bajo para las puntas', 'Se carga con discos']),

  // ——— Pecho
  e('press-banca', 'Press banca', ['banca', 'press banca', 'press de banca', 'bench', 'press plano'], 'pecho', 'Pecho, tríceps y hombro', 'Barra y banco', 'barbell', 75,
    ['press-pecho-maquina', 'press-mancuernas', 'flexiones'],
    ['Escápulas juntas, pies firmes en el suelo', 'Baja la barra a la parte baja del pecho', 'Empuja en línea recta sin despegar la espalda'], 'bench'),
  e('press-mancuernas', 'Press con mancuernas', ['press mancuernas', 'press plano mancuernas'], 'pecho', 'Pecho y tríceps', 'Mancuernas y banco', 'dumbbell', 26,
    ['press-banca', 'press-pecho-maquina'],
    ['Mancuernas a la altura del pecho, codos a 45°', 'Empuja hacia arriba juntándolas sin chocar', 'Baja controlando hasta notar el estiramiento'], 'bench'),
  e('press-inclinado-mancuernas', 'Press inclinado con mancuernas', ['press inclinado', 'inclinado', 'inclinado mancuernas'], 'pecho', 'Pecho superior', 'Mancuernas y banco', 'dumbbell', 22,
    ['press-pecho-maquina', 'press-mancuernas'],
    ['Banco a unos 30°, mancuernas a la altura del pecho', 'Empuja hacia arriba y un poco hacia dentro', 'Baja despacio con los codos algo por debajo del banco'], 'bench'),
  e('press-pecho-maquina', 'Press de pecho en máquina', ['press pecho maquina', 'press maquina', 'chest press'], 'pecho', 'Pecho y tríceps', 'Máquina', 'stack', 60,
    ['press-banca', 'press-mancuernas'],
    ['Agarres a la altura del pecho', 'Empuja sin bloquear codos', 'Vuelve hasta notar el pecho estirado'], 'machine',
    ['Asiento con respaldo vertical', 'Dos agarres que se empujan hacia delante', 'Placas o discos detrás']),
  e('aperturas-polea', 'Cruce de poleas', ['cruce poleas', 'aperturas polea', 'cruces', 'crossover'], 'pecho', 'Pecho', 'Poleas', 'stack', 15,
    ['contractor', 'press-mancuernas'],
    ['Poleas altas, un paso adelante con el pecho alto', 'Junta las manos delante con los codos algo flexionados', 'Abre despacio hasta notar el estiramiento'], 'cable'),
  e('contractor', 'Contractor de pecho', ['contractor', 'pec deck', 'mariposa', 'aperturas maquina'], 'pecho', 'Pecho', 'Máquina de placas', 'stack', 50,
    ['aperturas-polea', 'press-pecho-maquina'],
    ['Agarres a la altura de los hombros', 'Junta los brazos delante apretando el pecho', 'Abre despacio sin pasar de la línea de los hombros'], 'machine',
    ['Asiento con dos brazos que se cierran delante', 'Agarres verticales o almohadillas', 'Suele compartirse con el deltoide posterior']),
  e('flexiones', 'Flexiones', ['flexiones', 'push ups', 'lagartijas'], 'pecho', 'Pecho y tríceps', 'Peso corporal', 'bodyweight', 0,
    ['press-banca', 'press-pecho-maquina'],
    ['Manos algo más abiertas que los hombros, cuerpo recto', 'Baja el pecho casi al suelo', 'Empuja sin hundir la cadera'], 'bodyweight'),
  e('fondos', 'Fondos en paralelas', ['fondos', 'dips', 'paralelas'], 'pecho', 'Pecho y tríceps', 'Paralelas', 'bodyweight', 0,
    ['press-pecho-maquina', 'fondos-banco'],
    ['Brazos estirados, tronco algo inclinado', 'Baja hasta que los codos formen 90°', 'Sube empujando sin balancearte'], 'bodyweight'),

  // ——— Espalda
  e('jalon-pecho', 'Jalón al pecho', ['jalon', 'jalón', 'jalon pecho', 'polea al pecho', 'lat pulldown', 'polea alta'], 'espalda', 'Dorsal', 'Polea alta', 'stack', 55,
    ['dominadas', 'jalon-maquina', 'pullover-polea'],
    ['Agarre algo más ancho que los hombros, muslos bajo el rodillo', 'Lleva la barra a la parte alta del pecho bajando los codos', 'Sube controlando hasta estirar los brazos'], 'cable',
    ['Asiento con rodillo para los muslos', 'Barra larga colgando de una polea alta', 'Pila de placas detrás']),
  e('jalon-maquina', 'Jalón en máquina', ['jalon maquina', 'pulldown maquina'], 'espalda', 'Dorsal', 'Máquina de discos', 'plates', 60,
    ['jalon-pecho', 'dominadas'],
    ['Muslos bajo el rodillo, agarres arriba', 'Tira hacia abajo llevando los codos a las costillas', 'Sube despacio hasta estirar'], 'machine',
    ['Asiento con rodillo para los muslos', 'Dos brazos independientes arriba', 'Se carga con discos']),
  e('dominadas', 'Dominadas', ['dominadas', 'pull ups', 'chin ups'], 'espalda', 'Dorsal y bíceps', 'Barra fija', 'bodyweight', 0,
    ['jalon-pecho', 'jalon-maquina'],
    ['Cuelga con los brazos estirados y escápulas activas', 'Sube hasta pasar la barbilla de la barra', 'Baja del todo sin balancearte'], 'bodyweight'),
  e('remo-polea-baja', 'Remo en polea baja', ['remo polea', 'remo polea baja', 'remo sentado', 'remo gironda'], 'espalda', 'Espalda media y dorsal', 'Polea baja', 'stack', 55,
    ['remo-maquina', 'remo-mancuerna', 'remo-barra'],
    ['Pies apoyados, espalda recta, rodillas algo flexionadas', 'Lleva el agarre al abdomen juntando escápulas', 'Vuelve estirando los brazos sin encorvarte'], 'cable',
    ['Banco largo y bajo', 'Apoyos para los pies delante', 'Cable que sale de una polea baja']),
  e('remo-maquina', 'Remo en máquina', ['remo maquina', 'remo de pecho apoyado', 'remo apoyado'], 'espalda', 'Espalda media', 'Máquina', 'plates', 60,
    ['remo-polea-baja', 'remo-mancuerna'],
    ['Pecho apoyado en el soporte', 'Tira de los agarres llevando los codos atrás', 'Vuelve despacio hasta estirar'], 'machine',
    ['Almohadilla para apoyar el pecho', 'Agarres delante a la altura del pecho', 'Discos o placas']),
  e('remo-barra', 'Remo con barra', ['remo barra', 'remo con barra', 'remo inclinado'], 'espalda', 'Espalda media y dorsal', 'Barra', 'barbell', 60,
    ['remo-polea-baja', 'remo-t'],
    ['Inclínate unos 45° con la espalda neutra', 'Lleva la barra al ombligo', 'Baja controlando sin redondear la espalda'], 'barbell'),
  e('remo-t', 'Remo en T', ['remo t', 'remo en t', 't bar'], 'espalda', 'Espalda media', 'Barra en T', 'plates', 50,
    ['remo-barra', 'remo-maquina'],
    ['Pies firmes, pecho alto, agarre en la barra', 'Tira hacia el pecho juntando escápulas', 'Baja hasta estirar los brazos'], 'barbell'),
  e('remo-mancuerna', 'Remo con mancuerna', ['remo mancuerna', 'remo a una mano', 'remo unilateral'], 'espalda', 'Dorsal', 'Mancuerna y banco', 'dumbbell', 26,
    ['remo-polea-baja', 'remo-maquina'],
    ['Rodilla y mano en el banco, espalda plana', 'Lleva la mancuerna hacia la cadera', 'Baja hasta estirar el brazo'], 'bench'),
  e('pullover-polea', 'Pullover en polea', ['pullover', 'pullover polea', 'straight arm'], 'espalda', 'Dorsal', 'Polea alta', 'stack', 25,
    ['jalon-pecho'],
    ['De pie frente a la polea alta, brazos casi estirados', 'Baja la barra hasta los muslos', 'Sube despacio hasta la altura de los ojos'], 'cable'),
  e('face-pull', 'Face pull', ['face pull', 'facepull', 'jalon a la cara'], 'espalda', 'Deltoide posterior y manguito', 'Polea con cuerda', 'stack', 22.5,
    ['pajaros', 'deltoide-posterior-maquina'],
    ['Polea a la altura de la cara, agarre con cuerda', 'Tira hacia la frente abriendo los codos', 'Vuelve despacio sin perder la postura'], 'cable'),
  e('hiperextensiones', 'Hiperextensiones', ['hiperextensiones', 'lumbares', 'extensiones lumbares'], 'espalda', 'Lumbar y glúteo', 'Banco romano', 'bodyweight', 0,
    ['peso-muerto-rumano'],
    ['Cadera en el borde del banco, pies sujetos', 'Baja con la espalda neutra', 'Sube hasta alinear el cuerpo, sin pasarte'], 'bench'),
  e('peso-muerto', 'Peso muerto', ['peso muerto', 'deadlift'], 'espalda', 'Cadena posterior', 'Barra', 'barbell', 100,
    ['peso-muerto-rumano', 'remo-barra'],
    ['Barra sobre el medio del pie, espalda neutra', 'Empuja el suelo y sube la barra pegada a las piernas', 'Bloquea con glúteo y baja con control'], 'barbell'),

  // ——— Hombro
  e('press-militar-mancuernas', 'Press militar con mancuernas', ['press militar', 'press hombro', 'press militar mancuernas', 'press de hombro'], 'hombro', 'Hombro y tríceps', 'Mancuernas y banco', 'dumbbell', 16,
    ['press-hombro-maquina', 'press-militar-barra'],
    ['Sentado, respaldo vertical, mancuernas a la altura de las orejas', 'Empuja hacia arriba sin chocarlas', 'Baja hasta que los codos queden a 90°'], 'bench'),
  e('press-militar-barra', 'Press militar con barra', ['press militar barra', 'ohp', 'press de pie'], 'hombro', 'Hombro y tríceps', 'Barra', 'barbell', 40,
    ['press-militar-mancuernas', 'press-hombro-maquina'],
    ['De pie, barra en las clavículas, glúteo apretado', 'Empuja en línea recta pasando la cabeza', 'Baja controlando a las clavículas'], 'barbell'),
  e('press-hombro-maquina', 'Press de hombro en máquina', ['press hombro maquina', 'shoulder press'], 'hombro', 'Hombro y tríceps', 'Máquina', 'stack', 40,
    ['press-militar-mancuernas'],
    ['Agarres a la altura de los hombros', 'Empuja hacia arriba sin arquear la espalda', 'Baja despacio'], 'machine',
    ['Asiento con respaldo vertical', 'Agarres por encima de los hombros', 'Placas o discos']),
  e('elevaciones-laterales', 'Elevaciones laterales', ['laterales', 'elevaciones laterales', 'elevaciones'], 'hombro', 'Hombro lateral', 'Mancuernas', 'dumbbell', 8,
    ['laterales-polea', 'press-hombro-maquina'],
    ['De pie, mancuernas a los lados, codos algo flexionados', 'Sube hasta la altura de los hombros', 'Baja lento sin balancear el cuerpo'], 'dumbbell'),
  e('laterales-polea', 'Elevación lateral en polea', ['laterales polea', 'lateral polea'], 'hombro', 'Hombro lateral', 'Polea baja', 'stack', 7.5,
    ['elevaciones-laterales'],
    ['De lado a la polea baja, agarre con la mano contraria', 'Sube el brazo hasta la altura del hombro', 'Baja despacio'], 'cable'),
  e('pajaros', 'Pájaros', ['pajaros', 'pájaros', 'posterior', 'deltoide posterior', 'aperturas inversas'], 'hombro', 'Hombro posterior', 'Mancuernas', 'dumbbell', 8,
    ['deltoide-posterior-maquina', 'face-pull'],
    ['Inclínate con la espalda recta', 'Abre los brazos hacia los lados', 'Baja controlando'], 'dumbbell'),
  e('deltoide-posterior-maquina', 'Deltoide posterior en máquina', ['posterior maquina', 'reverse pec deck', 'contractor inverso'], 'hombro', 'Hombro posterior', 'Máquina de placas', 'stack', 35,
    ['pajaros', 'face-pull'],
    ['Pecho contra el respaldo, agarres delante', 'Abre los brazos hacia atrás', 'Vuelve despacio'], 'machine',
    ['Es el contractor sentado al revés', 'Pecho apoyado en el respaldo', 'Brazos que se abren hacia atrás']),
  e('encogimientos', 'Encogimientos', ['encogimientos', 'trapecio', 'shrugs'], 'hombro', 'Trapecio', 'Mancuernas', 'dumbbell', 30,
    ['remo-barra'],
    ['De pie, mancuernas a los lados', 'Sube los hombros hacia las orejas', 'Baja despacio sin girar'], 'dumbbell'),

  // ——— Brazos
  e('curl-barra', 'Curl con barra', ['curl barra', 'curl biceps', 'curl con barra'], 'brazos', 'Bíceps', 'Barra', 'barbell', 30,
    ['curl-mancuernas', 'curl-polea'],
    ['De pie, codos pegados al cuerpo', 'Sube la barra sin balancear', 'Baja del todo controlando'], 'barbell'),
  e('curl-mancuernas', 'Curl con mancuernas', ['curl mancuernas', 'curl alterno', 'curl'], 'brazos', 'Bíceps', 'Mancuernas', 'dumbbell', 12,
    ['curl-barra', 'curl-polea', 'curl-martillo'],
    ['Codos pegados, palmas hacia delante', 'Sube girando un poco la muñeca hacia fuera', 'Baja despacio hasta estirar'], 'dumbbell'),
  e('curl-martillo', 'Curl martillo', ['martillo', 'curl martillo', 'hammer'], 'brazos', 'Bíceps y braquial', 'Mancuernas', 'dumbbell', 14,
    ['curl-mancuernas', 'curl-polea'],
    ['Agarre neutro, palmas mirándose', 'Sube sin mover los codos', 'Baja controlando'], 'dumbbell'),
  e('curl-concentrado', 'Curl concentrado', ['concentrado', 'curl concentrado'], 'brazos', 'Bíceps', 'Mancuerna', 'dumbbell', 12,
    ['curl-polea', 'curl-predicador'],
    ['Sentado, codo apoyado en el interior del muslo', 'Sube la mancuerna hacia el hombro', 'Baja del todo'], 'dumbbell'),
  e('curl-polea', 'Curl en polea baja', ['curl polea', 'curl en polea', 'curl polea baja'], 'brazos', 'Bíceps', 'Polea baja', 'stack', 25,
    ['curl-barra', 'curl-mancuernas'],
    ['Frente a la polea baja, codos pegados', 'Sube la barra hasta el pecho', 'Baja hasta estirar sin soltar la tensión'], 'cable'),
  e('curl-inclinado', 'Curl inclinado', ['curl inclinado'], 'brazos', 'Bíceps', 'Mancuernas y banco', 'dumbbell', 10,
    ['curl-mancuernas', 'curl-polea'],
    ['Banco a 45°, brazos colgando detrás del cuerpo', 'Sube sin adelantar los codos', 'Baja hasta estirar del todo'], 'bench'),
  e('curl-predicador', 'Curl predicador', ['predicador', 'scott', 'banco scott', 'curl scott'], 'brazos', 'Bíceps', 'Máquina o banco Scott', 'stack', 25,
    ['curl-concentrado', 'curl-polea'],
    ['Brazos apoyados en el atril', 'Sube hasta casi vertical', 'Baja despacio sin bloquear abajo'], 'machine',
    ['Atril inclinado para apoyar los brazos', 'Asiento bajo', 'Barra Z o agarres']),
  e('triceps-polea', 'Extensión de tríceps en polea', ['triceps polea', 'tríceps', 'triceps', 'pushdown', 'extension triceps'], 'brazos', 'Tríceps', 'Polea alta', 'stack', 30,
    ['press-frances', 'fondos-banco', 'triceps-cabeza'],
    ['Codos pegados al cuerpo, agarre en la barra o cuerda', 'Baja hasta estirar los brazos', 'Sube hasta 90° sin mover los codos'], 'cable'),
  e('press-frances', 'Press francés', ['press frances', 'francés', 'skull crusher'], 'brazos', 'Tríceps', 'Barra Z y banco', 'barbell', 25,
    ['triceps-polea', 'triceps-cabeza'],
    ['Tumbado, barra sobre la frente con brazos verticales', 'Flexiona solo los codos', 'Extiende sin abrir los codos'], 'bench'),
  e('triceps-cabeza', 'Extensión por encima de la cabeza', ['triceps cabeza', 'extension sobre cabeza', 'copa triceps'], 'brazos', 'Tríceps', 'Polea o mancuerna', 'stack', 25,
    ['triceps-polea', 'press-frances'],
    ['De espaldas a la polea, cuerda detrás de la cabeza', 'Extiende los brazos hacia delante y arriba', 'Vuelve despacio hasta notar el estiramiento'], 'cable'),
  e('fondos-banco', 'Fondos en banco', ['fondos banco', 'fondos en banco', 'bench dips'], 'brazos', 'Tríceps', 'Banco', 'bodyweight', 0,
    ['triceps-polea', 'fondos'],
    ['Manos en el borde del banco, piernas delante', 'Baja hasta que los codos formen 90°', 'Sube empujando con los tríceps'], 'bench'),

  // ——— Core
  e('plancha', 'Plancha', ['plancha', 'plank'], 'core', 'Abdomen', 'Peso corporal', 'bodyweight', 0,
    ['rueda-abdominal', 'crunch-polea'],
    ['Antebrazos bajo los hombros, cuerpo recto', 'Aprieta glúteo y abdomen', 'Respira sin hundir la cadera'], 'bodyweight'),
  e('crunch-polea', 'Crunch en polea', ['crunch polea', 'crunch', 'abdominales polea'], 'core', 'Abdomen', 'Polea alta', 'stack', 35,
    ['plancha', 'elevacion-piernas'],
    ['De rodillas frente a la polea, cuerda junto a la cabeza', 'Enrolla el tronco llevando los codos a los muslos', 'Vuelve despacio'], 'cable'),
  e('elevacion-piernas', 'Elevación de piernas', ['elevacion piernas', 'elevaciones de piernas', 'leg raise'], 'core', 'Abdomen', 'Barra o banco', 'bodyweight', 0,
    ['crunch-polea', 'plancha'],
    ['Colgado o tumbado, piernas juntas', 'Sube las piernas sin balancearte', 'Baja despacio'], 'bodyweight'),
  e('rueda-abdominal', 'Rueda abdominal', ['rueda', 'rueda abdominal', 'ab wheel'], 'core', 'Abdomen', 'Rueda', 'bodyweight', 0,
    ['plancha'],
    ['De rodillas, rueda bajo los hombros', 'Rueda hacia delante con la espalda neutra', 'Vuelve tirando con el abdomen'], 'bodyweight'),
];

export const EXERCISES: Exercise[] = attachAlternatives(buildFreeCatalog(ORIGINAL_EXERCISES));

export const BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((x) => [x.id, x]));

export function ex(id: string | null | undefined): Exercise | undefined {
  return id ? BY_ID[id] : undefined;
}

export const GROUP_NAMES: Record<GroupId, string> = {
  pierna: 'Pierna',
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombro: 'Hombro',
  brazos: 'Brazos',
  core: 'Core',
};

export const DAY_GROUP_NAMES: Record<DayGroup, string> = {
  pierna: 'Pierna',
  torso: 'Torso',
  empuje: 'Empuje',
  tiron: 'Tirón',
  brazos: 'Brazos',
  hombro: 'Hombro',
  pecho: 'Pecho',
  espalda: 'Espalda',
  fullbody: 'Full body',
  core: 'Core',
};

export const LOAD_LABEL: Record<Load, string> = {
  plates: 'máquina de discos',
  stack: 'máquina',
  barbell: 'barra',
  dumbbell: 'mancuernas',
  bodyweight: 'peso corporal',
  other: 'carga total / otro material',
};

/** Grupo de día más probable a partir de los ejercicios */
export function inferDayGroup(ids: (string | null)[]): DayGroup {
  const c: Record<string, number> = {};
  for (const id of ids) {
    const x = ex(id);
    if (x) c[x.group] = (c[x.group] || 0) + 1;
  }
  const total = Object.values(c).reduce((a, b) => a + b, 0) || 1;
  const leg = (c.pierna || 0) / total;
  const upper = ((c.pecho || 0) + (c.espalda || 0) + (c.hombro || 0) + (c.brazos || 0)) / total;
  if (leg >= 0.6) return 'pierna';
  if (leg > 0.25 && upper > 0.25) return 'fullbody';
  const push = ((c.pecho || 0) + (c.hombro || 0)) / total;
  const pull = (c.espalda || 0) / total;
  if ((c.brazos || 0) / total >= 0.6) return 'brazos';
  if (push >= 0.6) return 'empuje';
  if (pull >= 0.6) return 'tiron';
  if (upper >= 0.6) return 'torso';
  return 'fullbody';
}

export function increment(x: Exercise | undefined, inc: { machine: number; dumbbell: number }): number {
  if (!x) return 2.5;
  if (x.load === 'dumbbell') return inc.dumbbell;
  if (x.load === 'bodyweight') return 0;
  return inc.machine;
}

/** Carga equivalente al cambiar de ejercicio */
export function equivalent(from: Exercise | undefined, to: Exercise | undefined, weight: number | null, inc: { machine: number; dumbbell: number }): number | null {
  if (from?.measure !== to?.measure || from?.alternativeNotes?.[to?.id || '']?.startsWith('Ejercicio relacionado')) return null;
  if (from?.imported || to?.imported) return null;
  if (!from || !to || weight === null || !from.ref || !to.ref) return to && to.load === 'bodyweight' ? null : weight;
  const step = increment(to, inc) || 1;
  return Math.max(step, Math.round((weight * to.ref) / from.ref / step) * step);
}


// Search includes Spanish muscles/materials and original English names.
const SEARCH_TEXT = new Map(EXERCISES.map((x) => [x.id, norm([
  x.name, ...x.aliases, x.muscles, x.equipment,
  ...(x.primaryMuscles || []).map((m) => MUSCLE_NAMES[m] || m),
  ...(x.secondaryMuscles || []).map((m) => MUSCLE_NAMES[m] || m),
].join(' '))]));

export function searchCatalog(query: string, group: 'all' | GroupId = 'all'): Exercise[] {
  const q = norm(query);
  const tokens = q.split(' ').filter(Boolean);
  return EXERCISES.filter((x) => (group === 'all' || x.group === group)
    && tokens.every((token) => SEARCH_TEXT.get(x.id)!.includes(token)))
    .sort((a, b) => {
      if (!q) return 0;
      const rank = (x: Exercise) => [x.name, ...x.aliases].some((name) => norm(name) === q) ? 2 : norm(x.name).startsWith(q) ? 1 : 0;
      return rank(b) - rank(a);
    });
}
