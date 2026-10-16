import { CATEGORY_NAMES, EQUIPMENT_NAMES, LEVEL_NAMES, type CatalogFilters } from '../data/free-exercises';

export function ExerciseFilters({ value, onChange }: { value: CatalogFilters; onChange: (next: CatalogFilters) => void }) {
  const options: [keyof CatalogFilters, string, Record<string, string>][] = [
    ['equipment', 'Material', EQUIPMENT_NAMES], ['level', 'Nivel', LEVEL_NAMES], ['category', 'Tipo', CATEGORY_NAMES],
  ];
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, margin: '8px 0' }}>
    {options.map(([key, label, names]) => <label key={key} className="xs mute" style={{ minWidth: 0 }}>
      {label}
      <select aria-label={`Filtrar por ${label.toLowerCase()}`} value={value[key]}
        onChange={(event) => onChange({ ...value, [key]: event.target.value })}
        style={{ display: 'block', width: '100%', minWidth: 0, height: 44, marginTop: 3, fontSize: 14, color: 'var(--ink)', background: 'var(--sheet)', border: '1px solid var(--line)', borderRadius: 4 }}>
        <option value="">Todos</option>
        {Object.entries(names).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>)}
  </div>;
}
