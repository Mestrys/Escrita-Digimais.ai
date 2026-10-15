import { diffLines } from '../diff';

export function DiffView({ before, after }: { before: string; after: string }) {
  if (before === after) return <p className="subtle">Nenhuma alteração em relação ao texto inicial.</p>;
  const lines = diffLines(before, after);
  return (
    <ul className="diff" aria-label="Diferenças entre o texto inicial e o texto atual">
      {lines.map((l, i) => (
        <li key={i} className={l.type === 'same' ? undefined : l.type}>
          {l.type === 'add' && <span className="tag info">Adicionada</span>}
          {l.type === 'del' && <span className="tag block">Removida</span>}
          {l.text || ' '}
        </li>
      ))}
    </ul>
  );
}
