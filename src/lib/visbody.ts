// Lector de informes Visbody en español e inglés, de 3 o más páginas.
// Las páginas se identifican por sus títulos, no por su posición.
// pdf.js da cada trozo de texto con su posición; buscamos cada etiqueta y
// cogemos el número que está en su misma fila, en la columna de valores.

export interface TextItem {
  s: string;
  x: number;
  y: number;
}

export interface ParsedBody {
  date: number | null;
  dateStr: string | null;
  score: number | null;
  postureScore: number | null;
  height: number | null;
  composition: Record<string, { value: number; min?: number; max?: number }>;
  posture: Record<string, { value: number; unit: string; note?: string }>;
  circumferences: Record<string, number>;
  segmental: { fat: Record<string, number>; lean: Record<string, number> } | null;
  issues: { key: string; label: string; kind: 'missing' | 'suspicious'; read?: number; guess?: number }[];
  isVisbody: boolean;
}

export const COMPOSITION_LABELS: Record<string, string> = {
  peso: 'Peso',
  smm: 'Músculo esquelético',
  masaMuscular: 'Masa muscular',
  masaMagra: 'Masa magra',
  grasaKg: 'Grasa',
  bfp: 'Grasa corporal',
  imc: 'IMC',
  icc: 'Índice cintura-cadera',
  tmb: 'Metabolismo basal',
  edadMetabolica: 'Edad metabólica',
  visceral: 'Grasa visceral',
  aguaTotal: 'Agua corporal',
  aguaIntra: 'Agua intracelular',
  aguaExtra: 'Agua extracelular',
  ecwTbw: 'Relación ECW/TBW',
  proteina: 'Proteína',
  sales: 'Sales inorgánicas',
};

export const COMPOSITION_UNITS: Record<string, string> = {
  peso: 'kg', smm: 'kg', masaMuscular: 'kg', masaMagra: 'kg', grasaKg: 'kg', bfp: '%', imc: '', icc: '', tmb: 'kcal',
  edadMetabolica: 'años', visceral: '', aguaTotal: 'kg', aguaIntra: 'kg', aguaExtra: 'kg', ecwTbw: '', proteina: 'kg', sales: 'kg',
};

export const POSTURE_LABELS: Record<string, string> = {
  cabezaAdelantada: 'Cabeza adelantada',
  inclinacionCabeza: 'Inclinación de la cabeza',
  hombroIzq: 'Hombro izquierdo redondeado',
  hombroDer: 'Hombro derecho redondeado',
  hombrosDesiguales: 'Hombros desiguales',
  pelvis: 'Pelvis adelantada',
  rodillaIzq: 'Rodilla izquierda',
  rodillaDer: 'Rodilla derecha',
  piernaIzq: 'Pierna izquierda',
  piernaDer: 'Pierna derecha',
};

export const CIRC_LABELS: Record<string, string> = {
  cuello: 'Cuello',
  brazoIzq: 'Brazo izquierdo',
  brazoDer: 'Brazo derecho',
  busto: 'Pecho',
  cinturaAlta: 'Cintura alta',
  cinturaMedia: 'Cintura media',
  cinturaBaja: 'Cintura baja',
  cadera: 'Cadera',
  musloIzq: 'Muslo izquierdo',
  musloDer: 'Muslo derecho',
  musloMinIzq: 'Muslo izq. (mínimo)',
  musloMinDer: 'Muslo der. (mínimo)',
  gemeloIzq: 'Gemelo izquierdo',
  gemeloDer: 'Gemelo derecho',
};

const normalize = (s: string) => s.normalize('NFKC').replace(/[−–]/g, '-').replace(/\bM\s+(?=asa|ass|uscle)/g, 'M').replace(/\s+/g, ' ').trim();

const num = (s: string): number | null => {
  const m = s.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

const range = (s: string): [number, number] | null => {
  const m = s.replace(/,/g, '.').match(/\[\s*(-?\d+(?:\.\d+)?)\s*~\s*(-?\d+(?:\.\d+)?)\s*\]/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
};

const isNumItem = (s: string) => /^-?\d+(?:[.,]\d+)?\s*(cm|°|kg|%)?(\s*\[.*\])?$/.test(s.trim());

function findLabel(items: TextItem[], test: (s: string) => boolean, maxX = 100): TextItem | undefined {
  const labels = items.filter((i) => i.x < maxX);
  const candidates = labels.flatMap((i) => {
    const below = labels.filter((j) => j !== i && Math.abs(j.x - i.x) < 5 && i.y > j.y && i.y - j.y <= 16)
      .sort((a, b) => b.y - a.y)[0];
    return below ? [i, { s: `${i.s} ${below.s}`, x: i.x, y: (i.y + below.y) / 2 }] : [i];
  });
  return candidates.filter((i) => test(normalize(i.s).replace(/\s*(?:kg(?:\/m²)?|kcal\/\s*d|cm|%)$/i, '').trim()))
    .sort((a, b) => b.y - a.y)[0];
}

function valueNear(items: TextItem[], label: TextItem | undefined, xMin: number, xMax: number, yTol = 10): TextItem | undefined {
  if (!label) return undefined;
  return items
    .filter((i) => i.x >= xMin && i.x <= xMax && Math.abs(i.y - label.y) <= yTol && isNumItem(i.s))
    .sort((a, b) => Math.abs(a.y - label.y) - Math.abs(b.y - label.y) || a.x - b.x)[0];
}

function pageOf(pages: TextItem[][], title: RegExp): TextItem[] | undefined {
  return pages.find((p) => p.some((i) => title.test(normalize(i.s))));
}

function parseDate(pages: TextItem[][]): { ms: number; str: string } | null {
  for (const p of pages) {
    for (const i of p) {
      const m = i.s.match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      if (m && p.some((j) => /Fecha de informe|Test Date\s*\/\s*Time/i.test(j.s) && Math.abs(j.y - i.y) < 6)) {
        const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 12), +(m[5] || 0), +(m[6] || 0));
        return { ms: d.getTime(), str: m[0] };
      }
      const e = i.s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
      if (e && p.some((j) => /Fecha|Test Date/i.test(j.s) && Math.abs(j.y - i.y) < 6)) {
        const d = new Date(+e[3], +e[2] - 1, +e[1], +(e[4] ?? 12), +(e[5] || 0));
        return { ms: d.getTime(), str: e[0] };
      }
    }
  }
  return null;
}

export function parseVisbody(pages: TextItem[][]): ParsedBody {
  pages = pages.map((page) => page.map((i) => ({ ...i, s: normalize(i.s) })));
  const out: ParsedBody = {
    date: null,
    dateStr: null,
    score: null,
    postureScore: null,
    height: null,
    composition: {},
    posture: {},
    circumferences: {},
    segmental: null,
    issues: [],
    isVisbody: false,
  };
  const comp = pageOf(pages, /(?:informe de composici[oó]n corporal|an[aá]lisis de composici[oó]n corporal|body composition (?:report|overview))/i);
  const post = pageOf(pages, /An[aá]lisis de postura|Posture Analysis Report/i);
  const circ = pageOf(pages, /circunferencia corporal|Body Circumference Report/i);
  out.isVisbody = Boolean(comp || post || circ) && pages.some((p) => p.some((i) => /Fecha de informe|Test Date\s*\/\s*Time/i.test(i.s)));
  const d = parseDate(pages);
  if (d) {
    out.date = d.ms;
    out.dateStr = d.str;
  }
  const hItem = pages.flat().find((i) => /^\d{2,3}\s*cm$/.test(i.s) && pages.some((p) => p.includes(i) && p.some((h) => /^(Altura|Height)\s*:/i.test(h.s) && Math.abs(h.y - i.y) <= 6)));
  if (hItem) out.height = num(hItem.s);

  if (comp) {
    const sc = comp.find((i) => /^(?:Resultado|Score)\s+\d+/.test(i.s));
    if (sc) out.score = num(sc.s.replace(/^(?:Resultado|Score)/i, ''));
    const put = (key: string, labelTest: (s: string) => boolean, xMin = 88, xMax = 240, tol = 10) => {
      const lab = findLabel(comp, labelTest);
      const v = valueNear(comp, lab, xMin, xMax, tol);
      if (!v) return;
      const value = num(v.s);
      if (value === null) return;
      let r = range(v.s);
      if (!r && lab) {
        const ri = comp.find((i) => i.x > v.x && i.x < 365 && Math.abs(i.y - v.y) <= 5 && range(i.s));
        if (ri) r = range(ri.s);
      }
      out.composition[key] = r ? { value, min: r[0], max: r[1] } : { value };
    };
    put('peso', (s) => /^(Peso|Weight)$/i.test(s));
    put('smm', (s) => s === 'SMM');
    put('grasaKg', (s) => /^(Masa corporal grasa|Body Fat Mass)$/i.test(s));
    put('bfp', (s) => s === 'BFP');
    put('imc', (s) => /^(IMC|BMI)$/i.test(s));
    put('icc', (s) => /^(ICC|WHR)$/i.test(s));
    put('tmb', (s) => /^(Tasa metab|Basal Metabolism)/i.test(s), 88, 240, 12);
    put('edadMetabolica', (s) => /^(Edad Metab|Metabolic Age)/i.test(s));
    put('visceral', (s) => /grasa visceral|Visceral Fat Level/i.test(s), 88, 240);
    put('aguaIntra', (s) => /^(Agua intracelular|ICW)$/i.test(s));
    put('aguaExtra', (s) => /^(Agua extracelular|ECW)$/i.test(s));
    put('ecwTbw', (s) => /ECW\/TBW|Relaci[oó]n de agua/i.test(s));
    put('masaMuscular', (s) => /^(Masa muscular|Muscle Mass)$/i.test(s));
    put('masaMagra', (s) => /^(Masa corporal(?: neta)?|Lean Body Mass)$/i.test(s));
    put('aguaTotal', (s) => /^(Agua en el cuerpo|Body Water)/i.test(s));
    // Proteína y sales: columnas bajo su cabecera
    const col = (key: string, header: RegExp) => {
      const h = comp.find((i) => i.x < 365 && header.test(i.s));
      if (!h) return;
      const v = comp
        .filter((i) => i.y < h.y && i.y > h.y - 80 && i.x >= (key === 'sales' ? 220 : h.x - 30) && i.x <= (key === 'sales' ? 285 : h.x + 40) && isNumItem(i.s))
        .sort((a, b) => b.y - a.y)[0];
      if (!v) return;
      const value = num(v.s);
      const ri = comp.find((i) => i.x > v.x && i.x < v.x + 45 && Math.abs(i.y - v.y) < 5 && range(i.s));
      const r = range(v.s) || (ri ? range(ri.s) : null);
      if (value !== null) out.composition[key] = r ? { value, min: r[0], max: r[1] } : { value };
    };
    col('proteina', /^(Prote[ií]na|Protein)$/i);
    col('sales', /Sales inorg|Inorganic Salts/i);
    // Segmentos (grasa y masa magra por brazo, tronco y pierna)
    const seg = (header: RegExp): Record<string, number> | null => {
      const h = comp.find((i) => i.x > 380 && header.test(i.s));
      if (!h) return null;
      const vs = comp.filter((i) => i.x > 380 && i.y < h.y - 15 && i.y > h.y - 105 && /^\d+(?:[.,]\d+)?$/.test(i.s));
      if (vs.length < 5) return null;
      const byY = [...vs].sort((a, b) => b.y - a.y);
      const arms = byY.filter((v) => Math.abs(v.y - byY[0].y) < 5).sort((a, b) => a.x - b.x);
      const legsY = byY[byY.length - 1].y;
      const legs = byY.filter((v) => Math.abs(v.y - legsY) < 5).sort((a, b) => a.x - b.x);
      const trunk = byY.find((v) => !arms.includes(v) && !legs.includes(v));
      if (arms.length < 2 || legs.length < 2 || !trunk) return null;
      return {
        brazoIzq: num(arms[0].s)!,
        brazoDer: num(arms[arms.length - 1].s)!,
        tronco: num(trunk.s)!,
        piernaIzq: num(legs[0].s)!,
        piernaDer: num(legs[legs.length - 1].s)!,
      };
    };
    const fat = seg(/segmentado de grasa|Segmental Fat Analysis/i);
    const lean = seg(/segmentado de masa|Segmental Lean Analysis/i);
    if (fat && lean) out.segmental = { fat, lean };
  }

  if (post) {
    const sc = post.find((i) => /^(?:Resultado|Score)\s+\d+/.test(i.s));
    if (sc) out.postureScore = num(sc.s.replace(/^(?:Resultado|Score)/i, ''));
    const noteX = post.find((i) => /Evaluation Conclusion|Conclusiones de/i.test(i.s))?.x ?? 240;
    const put = (key: string, labelTest: (s: string) => boolean, unit: string) => {
      const lab = findLabel(post, labelTest);
      const v = valueNear(post, lab, 110, 215, 10);
      if (!lab || !v) return;
      const value = num(v.s);
      if (value === null) return;
      const notes = post
        .filter((i) => i.x >= noteX - 2 && i.x < 345 && i.y <= v.y + 24 && i.y >= v.y - 24)
        .sort((a, b) => b.y - a.y)
        .map((i) => i.s.trim());
      out.posture[key] = { value, unit, note: notes.join(' ').replace(/\s+/g, ' ') || undefined };
    };
    put('cabezaAdelantada', (s) => /^(Postura de la cabeza|Forward Head Posture)/i.test(s), 'cm');
    put('inclinacionCabeza', (s) => /^(Inclinaci[oó]n de cabeza|Head tilt)/i.test(s), '°');
    put('hombroIzq', (s) => /(?:\(lado izquierdo\)|Rounded Shoulders Posture\s*\(left side\)|^Posture\s*\(left side\))/i.test(s), 'cm');
    put('hombroDer', (s) => /(?:\(lado derecho\)|Rounded Shoulders Posture\s*\(right side\)|^Posture\s*\(right side\))/i.test(s), 'cm');
    put('hombrosDesiguales', (s) => /^(Hombros desiguales|Uneven Shoulders)/i.test(s), '°');
    put('pelvis', (s) => /^(Desplazamiento p[eé]lvico|Inclinaci[oó]n p[eé]lvica|Anterior Pelvic Shift|Pelvic Forward Shift|Anterior pelvic tilt)/i.test(s), 'cm');
    put('rodillaIzq', (s) => /^(izquierda|Evaluaci[oó]n de la rodilla izquierda|Left Knee Evaluation)$/i.test(s), '°');
    put('rodillaDer', (s) => /^(derecha|Evaluaci[oó]n de la rodilla derecha|Right Knee Evaluation)$/i.test(s), '°');
    for (const i of post) {
      const row = post.filter((j) => Math.abs(j.y - i.y) < 3 && j.x >= i.x && j.x < 240).sort((a, b) => a.x - b.x).map((j) => j.s).join(' ');
      const m = row.match(/(?:Pierna (izquierda|derecha)|(Left|Right) leg)\s*[:：]\s*(-?\d+(?:[.,]\d+)?)/i);
      if (m) out.posture[/^(izquierda|left)$/i.test(m[1] || m[2]) ? 'piernaIzq' : 'piernaDer'] = { value: parseFloat(m[3].replace(',', '.')), unit: '°' };
    }
  }

  if (circ) {
    const put = (key: string, labelTest: (s: string) => boolean) => {
      const lab = findLabel(circ, labelTest, 330);
      const v = valueNear(circ, lab, 340, 400, 10);
      if (!v) return;
      const value = num(v.s);
      if (value !== null) out.circumferences[key] = value;
    };
    put('cuello', (s) => /^(Circunferencia del cuello|Neck circumference)$/i.test(s));
    put('brazoIzq', (s) => /^(Brazo izquierdo|Left upper arm)$/i.test(s));
    put('brazoDer', (s) => /^(Brazo derecho|Right upper arm)$/i.test(s));
    put('busto', (s) => /^(Busto|Chest)$/i.test(s));
    put('cinturaAlta', (s) => /^(Cintura alta|High waist)$/i.test(s));
    put('cinturaMedia', (s) => /^(Cintura media|Mid waist)$/i.test(s));
    put('cinturaBaja', (s) => /^(Cintura baja|Low waist)$/i.test(s));
    put('cadera', (s) => /^(L[ií]nea superior|Cadera|Hips|Hipline)$/i.test(s));
    put('musloIzq', (s) => /^(Muslo izquierdo|Left thigh)$/i.test(s));
    put('musloDer', (s) => /^(Circunferencia del muslo|Right thigh)$/i.test(s));
    put('musloMinIzq', (s) => /^(Circunferencia m[ií]nima(?: del)? (?:del )?muslo izquierdo|Minimum circumference(?: of)? (?:of )?left thigh)$/i.test(s));
    put('musloMinDer', (s) => /^(Circunferencia m[ií]nima(?: del)? (?:del )?muslo derecho|Minimum circumference(?: of)? (?:of )?right thigh)$/i.test(s));
    put('gemeloIzq', (s) => /^(pantorrilla izquierda|Per[ií]metro de la pantorrilla izquierda|Left calf circumference)$/i.test(s));
    put('gemeloDer', (s) => /^(pantorrilla derecha|Per[ií]metro de la pantorrilla derecha|Right calf circumference)$/i.test(s));
  }

  // Revisión: datos clave que faltan y valores fuera de toda lógica (p. ej. «6,23 kg» en vez de 62,3)
  for (const key of ['peso', 'smm', 'bfp', 'grasaKg', 'visceral']) {
    const v = out.composition[key];
    if (!v) {
      out.issues.push({ key, label: COMPOSITION_LABELS[key], kind: 'missing' });
      continue;
    }
    if (v.min !== undefined && v.max !== undefined) {
      if (v.value < v.min / 3 || v.value > v.max * 3) {
        const guess = [v.value * 10, v.value / 10].find((g) => g >= v.min! / 1.6 && g <= v.max! * 1.6);
        out.issues.push({ key, label: COMPOSITION_LABELS[key], kind: 'suspicious', read: v.value, guess });
      }
    }
  }
  if (!out.date) out.issues.unshift({ key: 'date', label: 'Fecha del informe', kind: 'missing' });
  return out;
}

/** Saca el texto de cada página de un PDF con pdf.js (se carga solo al usarlo) */
export async function extractPdf(data: ArrayBuffer): Promise<TextItem[][]> {
  const g = Math as unknown as { sumPrecise?: (a: number[]) => number };
  if (!g.sumPrecise) g.sumPrecise = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).href;
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  try {
    const doc = await task.promise;
    const pages: TextItem[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items: TextItem[] = [];
      for (const it of tc.items as { str?: string; transform?: number[] }[]) {
        if (!it.str || !it.str.trim() || !it.transform) continue;
        items.push({ s: it.str, x: it.transform[4], y: it.transform[5] });
      }
      pages.push(items);
    }
    return pages;
  } finally {
    await task.destroy().catch(() => undefined);
  }
}
