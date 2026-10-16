import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { AUTO_CLEAR_OPTIONS } from '../../application/preferences';
import type { Preferences } from '../../application/preferences';
import { FORMALITY_LABELS, LENGTH_LABELS, TECH_LEVEL_LABELS } from '../../config/fields';
import { FORMALITIES, LENGTHS, TECH_LEVELS } from '../../domain/types';
import type { LanguageProfile } from '../../domain/types';

interface Props {
  prefs: Preferences;
  onPrefs: (patch: Partial<Preferences>) => void;
  profile: LanguageProfile;
  profileSource: 'managed' | 'imported' | 'default';
  onImport: (text: string) => Promise<string[]>;
  onExport: () => void;
  onResetProfile: () => void;
  signingRequired: boolean;
}

const SOURCE_LABEL = { managed: 'política da organização', imported: 'arquivo importado', default: 'padrão da extensão' } as const;

export function SettingsPanel({
  prefs, onPrefs, profile, profileSource, onImport, onExport, onResetProfile, signingRequired,
}: Props) {
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const onFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDone(false);
    const text = await file.text();
    const errs = await onImport(text);
    setErrors(errs);
    setDone(errs.length === 0);
  };

  return (
    <section aria-labelledby="settings-title" className="stack">
      <h2 id="settings-title">Configurações</h2>
      <fieldset className="stack">
        <legend className="legend">Preferências (únicos dados salvos neste navegador)</legend>
        <div className="field">
          <label htmlFor="pref-tech">Nível técnico padrão</label>
          <select id="pref-tech" value={prefs.techLevel} onChange={(e) => onPrefs({ techLevel: e.target.value as Preferences['techLevel'] })}>
            {TECH_LEVELS.map((v) => <option key={v} value={v}>{TECH_LEVEL_LABELS[v]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pref-formality">Formalidade padrão</label>
          <select id="pref-formality" value={prefs.formality} onChange={(e) => onPrefs({ formality: e.target.value as Preferences['formality'] })}>
            {FORMALITIES.map((v) => <option key={v} value={v}>{FORMALITY_LABELS[v]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pref-length">Tamanho padrão</label>
          <select id="pref-length" value={prefs.length} onChange={(e) => onPrefs({ length: e.target.value as Preferences['length'] })}>
            {LENGTHS.map((v) => <option key={v} value={v}>{LENGTH_LABELS[v]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pref-clear">Limpar o conteúdo após inatividade</label>
          <select id="pref-clear" value={prefs.autoClearMinutes} onChange={(e) => onPrefs({ autoClearMinutes: Number(e.target.value) })}>
            {AUTO_CLEAR_OPTIONS.map((v) => (
              <option key={v} value={v}>{v === 0 ? 'Desativado' : `${v} minutos`}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="stack">
        <legend className="legend">Perfil de linguagem</legend>
        <p>
          Versão <strong>{profile.profileVersion}</strong>
          {profile.organizationName && <> da organização <strong>{profile.organizationName}</strong></>}. Origem: {SOURCE_LABEL[profileSource]}.
        </p>
        <p className="subtle">
          A importação valida o esquema e recusa HTML, links e chaves desconhecidas. Nada é enviado: o arquivo é lido
          apenas neste navegador.
          {signingRequired && ' A organização exige perfil assinado: arquivos sem assinatura válida são recusados.'}
        </p>
        <div className="row">
          {profileSource !== 'managed' && (
            <div className="field">
              <label htmlFor="profile-file">Importar perfil (JSON)</label>
              <input id="profile-file" type="file" accept="application/json,.json" onChange={(e) => void onFile(e)} />
            </div>
          )}
        </div>
        <div className="row">
          <button type="button" onClick={onExport}>Exportar perfil atual</button>
          {profileSource === 'imported' && <button type="button" onClick={onResetProfile}>Restaurar perfil padrão</button>}
        </div>
        {errors.length > 0 && (
          <div role="alert" className="panel block">
            <p className="error-text">Importação recusada. Corrija os itens abaixo:</p>
            <ul>{errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
          </div>
        )}
        {done && <p role="status" className="panel ok">Perfil importado e validado.</p>}
      </fieldset>
    </section>
  );
}
