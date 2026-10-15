import type { QualityDimension, QualityScore, Severity, Warning } from '../../domain/types';

const SEVERITY_LABEL: Record<Severity, string> = { block: 'Bloqueio', warning: 'Alerta', info: 'Informação' };
const DIMENSION_LABEL: Record<QualityDimension, string> = {
  clarity: 'Clareza',
  objectivity: 'Objetividade',
  cordiality: 'Cordialidade',
  completeness: 'Completude',
  safety: 'Segurança',
};
const ORDER: QualityDimension[] = ['clarity', 'objectivity', 'cordiality', 'completeness', 'safety'];

export function WarningsList({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) {
    return <p className="panel ok">Nenhum alerta pelas regras locais. Revise o texto mesmo assim.</p>;
  }
  return (
    <ul className="list" aria-label="Alertas da revisão">
      {warnings.map((w, i) => (
        <li key={`${w.code}-${i}`}>
          <span className={`tag ${w.severity}`}>{SEVERITY_LABEL[w.severity]}</span>
          {w.message}
          {w.excerpt && (
            <p className="subtle">
              Trecho: <mark>{w.excerpt}</mark>
            </p>
          )}
          {w.suggestion && <p className="subtle">Sugestão: {w.suggestion}</p>}
        </li>
      ))}
    </ul>
  );
}

export function QualityPanel({ quality }: { quality: QualityScore }) {
  return (
    <section aria-labelledby="quality-title">
      <h3 id="quality-title">Indicadores locais</h3>
      <p className="subtle">
        Heurísticas por regras, de 0 a 100. Não são uma avaliação objetiva. Veja abaixo as regras acionadas.
      </p>
      <ul className="quality">
        {ORDER.map((d) => (
          <li key={d}>
            <label htmlFor={`q-${d}`}>
              {DIMENSION_LABEL[d]}: <strong>{quality[d]}</strong>/100
            </label>
            <progress id={`q-${d}`} max={100} value={quality[d]} />
          </li>
        ))}
      </ul>
    </section>
  );
}
