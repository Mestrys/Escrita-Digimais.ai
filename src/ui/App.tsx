import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emptyContent, initialForm, TEXT_FORM_FIELDS, toGenerationInput } from '../application/form';
import type { FormState, TextFormField } from '../application/form';
import { DEFAULT_PREFERENCES } from '../application/preferences';
import type { Preferences } from '../application/preferences';
import { createProvider, DISABLED_AI_POLICY, generateWithFallback } from '../application/provider';
import type { AiPolicy, TextGenerationProvider } from '../application/provider';
import {
  FIELD_META, fieldHint, fieldLabel, FORMALITY_LABELS, LENGTH_LABELS, RECIPIENT_LABELS, TECH_LEVEL_LABELS, TYPE_FIELDS,
} from '../config/fields';
import { DEFAULT_PROFILE } from '../config/language-profile';
import { exportProfileJson, parseProfileJson } from '../config/profile-schema';
import { applyOverlay, parseOverlayJson } from '../config/profile-overlay';
import type { ProfileOverlay } from '../config/profile-overlay';
import { reviewText } from '../domain/review';
import { scanText } from '../domain/sensitive';
import { SUFFICIENCY_MATRIX } from '../domain/sufficiency';
import { COMMUNICATION_TYPES, FORMALITIES, LENGTHS, RECIPIENTS, TECH_LEVELS } from '../domain/types';
import type {
  CommunicationType, ContextField, GenerationResult, LanguageProfile, QualityScore, SensitiveFinding, Warning,
} from '../domain/types';
import { copyText } from '../infrastructure/clipboard';
import { AppStorage } from '../infrastructure/storage';
import { loadAiPolicy } from '../infrastructure/policy';
import { DiffView } from './components/DiffView';
import { FieldControl } from './components/FieldControl';
import type { Requirement } from './components/FieldControl';
import { QualityPanel, WarningsList } from './components/ReviewPanel';
import { SensitivePanel } from './components/SensitivePanel';
import { SettingsPanel } from './components/SettingsPanel';

export interface AppProps {
  storage?: AppStorage;
  loadPolicy?: () => Promise<AiPolicy>;
  copy?: (text: string) => Promise<boolean>;
  providerFactory?: (policy: AiPolicy) => TextGenerationProvider;
  now?: () => Date;
}

function requirementFor(type: CommunicationType, field: ContextField): Requirement {
  let best: Requirement;
  for (const req of SUFFICIENCY_MATRIX[type]) {
    if (!req.anyOf.includes(field)) continue;
    if (req.level === 'required') return req.anyOf.length === 1 ? 'required' : 'oneOf';
    best = 'recommended';
  }
  return best;
}

const BLOCK_TITLES: Record<NonNullable<GenerationResult['blockReason']>, string> = {
  sensitive_data: 'Geração bloqueada: foram detectadas credenciais, tokens ou chaves.',
  missing_information: 'Faltam informações essenciais. Nada foi inventado.',
  policy: 'Geração bloqueada por regra da organização.',
  inconsistent: 'Geração bloqueada: o contexto é inconsistente com este tipo de texto.',
  unsafe_content: 'Geração bloqueada: o texto pediria algo que não deve ser solicitado.',
  input_too_long: 'Geração bloqueada: conteúdo grande demais.',
};

export function App({ storage, loadPolicy = loadAiPolicy, copy = copyText, providerFactory = createProvider, now }: AppProps) {
  const store = useMemo(() => storage ?? new AppStorage(), [storage]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [baseProfile, setProfile] = useState<LanguageProfile>(DEFAULT_PROFILE);
  const [overlay, setOverlay] = useState<ProfileOverlay | null>(null);
  const profile = useMemo(() => applyOverlay(baseProfile, overlay), [baseProfile, overlay]);
  const [profileSource, setProfileSource] = useState<'managed' | 'imported' | 'default'>('default');
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [policy, setPolicy] = useState<AiPolicy>(DISABLED_AI_POLICY);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [text, setText] = useState('');
  const [initialText, setInitialText] = useState('');
  const [snapshot, setSnapshot] = useState<{ warnings: Warning[]; quality: QualityScore } | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState<'none' | 'ok' | 'fail'>('none');
  const [confirmClear, setConfirmClear] = useState(false);
  const [alsoClearStored, setAlsoClearStored] = useState(false);
  const [live, setLive] = useState('');
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<{ field: TextFormField; previous: string; label: string } | null>(null);
  const [activity, setActivity] = useState(0);
  const touched = useRef(new Set<string>());
  const previewRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [p, loaded, pol, ov] = await Promise.all([
        store.loadPreferences(), store.loadProfile(), loadPolicy(), store.loadOverlay(),
      ]);
      if (!alive) return;
      setPrefs(p);
      setProfile(loaded.profile);
      setProfileSource(loaded.source);
      setPolicy(pol);
      setOverlay(ov);
      setForm((f) => ({ ...f, techLevel: p.techLevel, formality: p.formality, length: p.length }));
    })();
    return () => {
      alive = false;
    };
  }, [store, loadPolicy]);

  const touch = useCallback(() => setActivity((n) => n + 1), []);

  const clearContent = useCallback(() => {
    setForm((f) => ({ ...f, ...emptyContent(), variant: 0 }));
    setResult(null);
    setText('');
    setInitialText('');
    setSnapshot(null);
    setShowDiff(false);
    setCopied('none');
    setUndo(null);
  }, []);

  // Limpeza por inatividade (configurável). O estado vive só em memória.
  useEffect(() => {
    if (!prefs.autoClearMinutes) return;
    const id = window.setTimeout(() => {
      clearContent();
      setLive('Conteúdo limpo por inatividade.');
    }, prefs.autoClearMinutes * 60_000);
    return () => window.clearTimeout(id);
  }, [activity, prefs.autoClearMinutes, clearContent]);

  const fields = TYPE_FIELDS[form.type];
  const visible = useMemo(() => new Set<string>([...fields.main, ...fields.advanced]), [fields]);

  const findings = useMemo(() => {
    const all: SensitiveFinding[] = [];
    for (const field of TEXT_FORM_FIELDS) {
      if (!visible.has(field)) continue;
      all.push(...scanText(form[field], { field: field as ContextField, internalDomains: profile.internalDomains }));
    }
    return all;
  }, [form, visible, profile.internalDomains]);

  const values = useMemo(() => {
    const v: Partial<Record<ContextField, string>> = {};
    for (const f of TEXT_FORM_FIELDS) v[f as ContextField] = form[f];
    return v;
  }, [form]);

  const reviewCtx = useMemo(
    () => ({
      type: form.type,
      recipient: form.recipient,
      techLevel: form.techLevel,
      explicitDeadline: form.explicitDeadline.trim() || undefined,
      hasEvidence: form.evidence.trim().length > 0,
      userConfirmation: form.userConfirmation,
      pendingItem: form.pendingItem.trim() || undefined,
    }),
    [form],
  );

  const liveReview = useMemo(
    () => (text ? reviewText(text, reviewCtx, profile) : null),
    [text, reviewCtx, profile],
  );

  const fieldErrors = useMemo(() => {
    const out: Partial<Record<ContextField, string>> = {};
    for (const w of result?.warnings ?? []) {
      if (w.severity === 'block' && w.field && !out[w.field]) out[w.field] = w.suggestion ? `${w.message} ${w.suggestion}` : w.message;
    }
    return out;
  }, [result]);

  const setField = (name: TextFormField, value: string): void => {
    setForm((f) => ({ ...f, [name]: value }));
    touch();
  };

  const setStyle = (name: 'techLevel' | 'formality' | 'length', value: string): void => {
    touched.current.add(name);
    setForm((f) => ({ ...f, [name]: value }));
    touch();
  };

  const setType = (type: CommunicationType): void => {
    setForm((f) => ({ ...f, type, variant: 0 }));
    setResult(null);
    setText('');
    setInitialText('');
    setSnapshot(null);
    touch();
  };

  const setRecipient = (recipient: FormState['recipient']): void => {
    const rp = profile.recipients[recipient];
    setForm((f) => ({
      ...f,
      recipient,
      techLevel: touched.current.has('techLevel') ? f.techLevel : rp.defaultTechLevel,
      formality: touched.current.has('formality') ? f.formality : rp.defaultFormality,
    }));
    touch();
  };

  const run = async (next: FormState): Promise<void> => {
    setBusy(true);
    setCopied('none');
    const provider = providerFactory(policy);
    const outcome = await generateWithFallback(provider, { input: toGenerationInput(next), profile, now: now?.() });
    const r = outcome.result;
    setResult(outcome.notice ? { ...r, warnings: [...r.warnings, outcome.notice] } : r);
    setText(r.text);
    setInitialText(r.text);
    setSnapshot(null);
    setShowDiff(false);
    setBusy(false);
    if (r.blocked) setLive('Geração bloqueada. O motivo está na seção de prévia e revisão.');
    else setLive(`Prévia gerada com ${r.warnings.length} alerta(s). Revise antes de copiar.`);
    touch();
  };

  const onGenerate = (): void => void run(form);
  const onVariant = (): void => {
    const next = { ...form, variant: form.variant + 1 };
    setForm(next);
    void run(next);
  };

  const onReview = (): void => {
    if (!liveReview) return;
    const inputLevel = (result?.warnings ?? []).filter((w) => w.field && !liveReview.warnings.some((x) => x.code === w.code));
    setSnapshot({ warnings: [...liveReview.warnings, ...inputLevel], quality: liveReview.quality });
    setLive(`Revisão concluída: ${liveReview.warnings.length} alerta(s) no texto atual.`);
    touch();
  };

  const onCopy = async (): Promise<void> => {
    const ok = await copy(text);
    setCopied(ok ? 'ok' : 'fail');
    setLive(ok ? 'Texto copiado.' : 'Não foi possível copiar. Selecione o texto e copie manualmente.');
  };

  const onMask = (f: SensitiveFinding): void => {
    if (!f.field) return;
    const name = f.field as TextFormField;
    const previous = form[name];
    setUndo({ field: name, previous, label: `Trecho substituído em “${fieldLabel(f.field, form.type)}”.` });
    setField(name, previous.slice(0, f.start) + f.placeholder + previous.slice(f.end));
    setLive('Trecho substituído por marcador de omissão.');
  };

  const onUndo = (): void => {
    if (!undo) return;
    setField(undo.field, undo.previous);
    setUndo(null);
    setLive('Alteração desfeita.');
  };

  const doClearAll = async (): Promise<void> => {
    clearContent();
    if (alsoClearStored) {
      await store.clearAll();
      setPrefs(DEFAULT_PREFERENCES);
      setProfile(DEFAULT_PROFILE);
      setProfileSource('default');
      setOverlay(null);
    }
    setConfirmClear(false);
    setAlsoClearStored(false);
    setLive(alsoClearStored ? 'Conteúdo e dados armazenados apagados.' : 'Conteúdo apagado.');
  };

  const onPrefs = (patch: Partial<Preferences>): void => {
    setPrefs((p) => ({ ...p, ...patch }));
    void store.savePreferences(patch);
  };

  const onImport = async (json: string): Promise<string[]> => {
    const parsed = parseProfileJson(json);
    if (!parsed.ok) return parsed.errors;
    await store.saveProfile(parsed.profile);
    setProfile(parsed.profile);
    setProfileSource('imported');
    return [];
  };

  const onExport = (): void => {
    const blob = new Blob([exportProfileJson(baseProfile)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'perfil-de-linguagem.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportOverlay = async (json: string): Promise<string[]> => {
    const parsed = parseOverlayJson(json);
    if (!parsed.ok) return parsed.errors;
    await store.saveOverlay(parsed.overlay);
    setOverlay(parsed.overlay);
    return [];
  };

  const onRemoveOverlay = async (): Promise<void> => {
    await store.removeOverlay();
    setOverlay(null);
    setLive('Camada da equipe removida.');
  };

  const onResetProfile = async (): Promise<void> => {
    const keepOverlay = overlay;
    await store.clearAll();
    if (keepOverlay) await store.saveOverlay(keepOverlay);
    const loaded = await store.loadProfile();
    setProfile(loaded.profile);
    setProfileSource(loaded.source);
    await store.savePreferences(prefs);
  };

  const focusField = (field?: ContextField): void => {
    if (field) document.getElementById(`field-${field}`)?.focus();
  };

  const noResponseOff = form.type === 'closure_no_response' && !profile.closureRules.noResponseEnabled;
  const shownWarnings = snapshot?.warnings ?? result?.warnings ?? [];
  const shownQuality = snapshot?.quality ?? result?.quality;
  const copyBlocked = !text || Boolean(liveReview?.blocked);
  const over = text.length > profile.maxLength;

  const renderField = (name: ContextField) => {
    if (name === 'userConfirmation') {
      return (
        <div className="field" key={name}>
          <label htmlFor="field-userConfirmation">{fieldLabel(name, form.type)}</label>
          <select
            id="field-userConfirmation"
            value={form.userConfirmation}
            onChange={(e) => {
              setForm((f) => ({ ...f, userConfirmation: e.target.value as FormState['userConfirmation'] }));
              touch();
            }}
          >
            <option value="unknown">Sem confirmação registrada</option>
            <option value="yes">Confirmado pelo usuário</option>
            <option value="no">Usuário informou que não resolveu</option>
          </select>
          {fieldErrors.userConfirmation && <p role="alert" className="error-text">{fieldErrors.userConfirmation}</p>}
        </div>
      );
    }
    const key = name as TextFormField;
    return (
      <FieldControl
        key={name}
        name={name}
        label={fieldLabel(name, form.type)}
        hint={fieldHint(name, form.type)}
        meta={FIELD_META[name]}
        value={form[key]}
        onChange={(v) => setField(key, v)}
        error={fieldErrors[name]}
        requirement={requirementFor(form.type, name)}
        warning={findings.some((f) => f.field === name) ? 'Este campo contém possível dado sensível. Veja o painel abaixo.' : undefined}
      />
    );
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Assistente de Textos do Service Desk</h1>
        <div className="row">
          <button type="button" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}>
            Configurações
          </button>
          <button type="button" className="danger" onClick={() => setConfirmClear(true)}>
            Limpar tudo
          </button>
        </div>
      </header>

      <div role="status" aria-live="polite" className="visually-hidden">
        {live}
      </div>

      <main>
        <p className="subtle">
          Auxilia a redação. Você revisa e copia o texto; nada é enviado, salvo ou aplicado ao chamado. Não cole senhas,
          tokens ou dados pessoais desnecessários.
        </p>

        {confirmClear && (
          <section className="panel warn" role="alertdialog" aria-labelledby="confirm-title" aria-modal="false">
            <h2 id="confirm-title">Apagar todo o conteúdo?</h2>
            <p>O formulário, a prévia e os resultados serão apagados deste painel.</p>
            <div className="row">
              <input
                id="also-stored"
                type="checkbox"
                checked={alsoClearStored}
                onChange={(e) => setAlsoClearStored(e.target.checked)}
              />
              <label htmlFor="also-stored">Apagar também preferências e perfil importado salvos neste navegador</label>
            </div>
            <div className="row">
              <button type="button" className="danger" onClick={() => void doClearAll()}>Apagar agora</button>
              <button type="button" onClick={() => setConfirmClear(false)}>Cancelar</button>
            </div>
          </section>
        )}

        {showSettings && (
          <SettingsPanel
            prefs={prefs}
            onPrefs={onPrefs}
            profile={profile}
            profileSource={profileSource}
            onImport={onImport}
            onExport={onExport}
            onResetProfile={() => void onResetProfile()}
            overlay={overlay}
            onImportOverlay={onImportOverlay}
            onRemoveOverlay={() => void onRemoveOverlay()}
          />
        )}

        <form className="stack" autoComplete="off" onSubmit={(e) => { e.preventDefault(); onGenerate(); }}>
          <h2>1. Tipo de comunicação</h2>
          <div className="field">
            <label htmlFor="type">Tipo de comunicação</label>
            <select id="type" value={form.type} onChange={(e) => setType(e.target.value as CommunicationType)}>
              {COMMUNICATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {profile.categoryNames[t]}
                  {t === 'closure_no_response' && !profile.closureRules.noResponseEnabled ? ' (desativado pela organização)' : ''}
                </option>
              ))}
            </select>
          </div>
          {noResponseOff && (
            <p className="panel info" role="note">
              Este tipo está desativado pela organização. Um administrador pode habilitá-lo no perfil de linguagem
              (closureRules.noResponseEnabled) com o número mínimo de tentativas e o aviso prévio.
            </p>
          )}
          <div className="field">
            <label htmlFor="recipient">Destinatário</label>
            <select id="recipient" value={form.recipient} onChange={(e) => setRecipient(e.target.value as FormState['recipient'])}>
              {RECIPIENTS.map((r) => <option key={r} value={r}>{RECIPIENT_LABELS[r]}</option>)}
            </select>
          </div>

          <h2>2. Contexto</h2>
          {fields.main.map(renderField)}
          <details>
            <summary>Campos opcionais</summary>
            <div className="stack">{fields.advanced.map(renderField)}</div>
          </details>

          <h2>3. Estilo</h2>
          <div className="row">
            <div className="field">
              <label htmlFor="techLevel">Nível técnico</label>
              <select id="techLevel" value={form.techLevel} onChange={(e) => setStyle('techLevel', e.target.value)}>
                {TECH_LEVELS.map((v) => <option key={v} value={v}>{TECH_LEVEL_LABELS[v]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="formality">Grau de formalidade</label>
              <select id="formality" value={form.formality} onChange={(e) => setStyle('formality', e.target.value)}>
                {FORMALITIES.map((v) => <option key={v} value={v}>{FORMALITY_LABELS[v]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="length">Tamanho</label>
              <select id="length" value={form.length} onChange={(e) => setStyle('length', e.target.value)}>
                {LENGTHS.map((v) => <option key={v} value={v}>{LENGTH_LABELS[v]}</option>)}
              </select>
            </div>
          </div>

          <SensitivePanel
            type={form.type}
            values={values}
            findings={findings}
            onMask={onMask}
            undoLabel={undo?.label}
            onUndo={onUndo}
          />

          <div className="row">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Gerando…' : 'Gerar prévia'}
            </button>
          </div>
        </form>

        <section aria-labelledby="result-title" className="stack">
          <h2 id="result-title">4. Prévia e revisão</h2>

          {!result && <p className="subtle">Preencha os campos e escolha “Gerar prévia”. A prévia aparecerá aqui, editável.</p>}

          {result?.blocked && (
            <div role="alert" className="panel block">
              <p className="error-text">{result.blockReason ? BLOCK_TITLES[result.blockReason] : 'Geração bloqueada.'}</p>
              {result.missingInformation.length > 0 && (
                <ul>
                  {result.missingInformation.map((q, i) => (
                    <li key={q}>
                      {q}{' '}
                      <button type="button" onClick={() => focusField(result.missingFields[i])}>Ir para o campo</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result && !result.blocked && (
            <div className="stack">
              <div className="field">
                <label htmlFor="preview">Prévia editável</label>
                <textarea
                  id="preview"
                  ref={previewRef}
                  className="preview"
                  rows={14}
                  value={text}
                  autoComplete="off"
                  aria-describedby="preview-counter"
                  onChange={(e) => {
                    setText(e.target.value);
                    setSnapshot(null);
                    setCopied('none');
                    touch();
                  }}
                />
                <span id="preview-counter" className={`counter${over ? ' over' : ''}`}>
                  {text.length} / {profile.maxLength} caracteres{over ? ' (acima do limite da organização)' : ''}
                </span>
              </div>
              {liveReview?.blocked && (
                <p role="alert" className="error-text">
                  O texto atual contém algo que impede a cópia (credencial, token ou pedido de acesso). Remova-o para copiar.
                </p>
              )}
              <div className="row">
                <button type="button" className="primary" onClick={() => void onCopy()} disabled={copyBlocked}>Copiar texto</button>
                <button type="button" onClick={onReview}>Revisar novamente</button>
                <button type="button" onClick={onVariant} disabled={busy}>Outra variação</button>
                <button type="button" onClick={() => { setText(initialText); setSnapshot(null); touch(); }}>Restaurar modelo</button>
                <button type="button" onClick={() => setShowDiff((s) => !s)} aria-pressed={showDiff}>Comparar com o texto inicial</button>
                <button type="button" onClick={clearContent}>Limpar</button>
              </div>
              {copied === 'ok' && (
                <div role="status" className="panel ok">
                  <p>Texto copiado. Deseja limpar o conteúdo agora?</p>
                  <div className="row">
                    <button type="button" onClick={clearContent}>Limpar agora</button>
                    <button type="button" onClick={() => setCopied('none')}>Manter</button>
                  </div>
                </div>
              )}
              {copied === 'fail' && <p role="alert" className="error-text">Não foi possível copiar automaticamente. Selecione o texto da prévia e copie manualmente.</p>}
              {showDiff && <DiffView before={initialText} after={text} />}
            </div>
          )}

          {result && (
            <>
              <h3>Alertas</h3>
              <WarningsList warnings={shownWarnings} />
              {shownQuality && !result.blocked && <QualityPanel quality={shownQuality} />}
              <p className="subtle">
                Motor {result.meta.engine}, perfil {result.meta.profileVersion}, templates {result.meta.templatesVersion}.
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
