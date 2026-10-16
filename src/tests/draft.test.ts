import { describe, expect, it } from 'vitest';
import { assembleDraft, classifyDraft, segmentDraft } from '../domain/draft';
import { DRAFT_EVAL, DRAFT_EVAL_HARD } from './eval/draft-eval';

describe('divisão do rascunho', () => {
  it('separa por linha e por frase, remove marcadores e pontuação final', () => {
    expect(segmentDraft('- usuário sem acesso. resetei a senha;\n2) testei o login\n\n\n  ok  ')).toEqual([
      'usuário sem acesso',
      'resetei a senha',
      'testei o login',
      'ok',
    ]);
  });

  it('descarta trechos vazios ou sem letras e limita a quantidade', () => {
    expect(segmentDraft('...\n--\n12\n')).toEqual([]);
    expect(segmentDraft(Array.from({ length: 80 }, (_, i) => `trecho número ${i}`).join('\n')).length).toBe(40);
  });

  it('mantém o ponto de interrogação para a classificação', () => {
    expect(segmentDraft('qual o erro? acontece sempre?')).toEqual(['qual o erro?', 'acontece sempre?']);
  });
});

describe('classificação do rascunho', () => {
  const one = (t: string) => classifyDraft(`contexto qualquer do chamado\n${t}`)[1]!;

  it('pergunta por interrogação ou por palavra interrogativa', () => {
    expect(one('acontece em outro computador?').predicted).toBe('question');
    expect(one('quando começou').predicted).toBe('question');
  });

  it('o que ainda será feito vira ação planejada, nunca ação feita', () => {
    const s = one('vou validar com o usuário amanhã');
    expect(s.predicted).toBe('action');
    expect(s.planned).toBe(true);
    expect(one('resetei a senha no AD').planned).toBe(false);
  });

  it('regras decisivas: ação, pendência e resultado', () => {
    expect(one('reinstalei o driver').predicted).toBe('action');
    expect(one('Validadas as permissões do usuário').predicted).toBe('action');
    expect(one('aguardando teste do usuário').predicted).toBe('pending');
    expect(one('o erro persiste após a reinstalação').predicted).toBe('result');
  });

  it('o primeiro trecho tende a ser contexto', () => {
    expect(classifyDraft('usuário sem acesso à VPN desde ontem')[0]?.predicted).toBe('summary');
  });

  it('é determinístico e sempre devolve motivo e confiança entre 0 e 1', () => {
    const note = DRAFT_EVAL[0]!.note;
    expect(classifyDraft(note)).toEqual(classifyDraft(note));
    for (const s of classifyDraft(note)) {
      expect(s.confidence).toBeGreaterThan(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
      expect(s.reason.length).toBeGreaterThan(5);
    }
  });

  it('o viés aprendido só entra como desempate e aparece no motivo', () => {
    const text = 'situação estranha no equipamento';
    const base = classifyDraft(text)[0]!;
    const biased = classifyDraft(text, { pending: 50 })[0]!;
    expect(biased.predicted).toBe('pending');
    expect(biased.reason).toContain('correções');
    expect(base.predicted).not.toBe('pending');
    expect(classifyDraft('qual o erro?', { pending: 50 })[0]!.predicted).toBe('question');
  });
});

describe('montagem dos campos', () => {
  it('monta cada campo sem alterar o conteúdo dos trechos', () => {
    const f = assembleDraft([
      { text: 'usuário sem acesso', target: 'summary', planned: false },
      { text: 'resetei a senha', target: 'action', planned: false },
      { text: 'vou validar amanhã', target: 'action', planned: true },
      { text: 'login ok', target: 'result', planned: false },
      { text: 'aguardando o usuário', target: 'pending', planned: false },
      { text: 'enviar o print', target: 'expected', planned: false },
      { text: 'qual o erro?', target: 'question', planned: false },
      { text: 'descartar isto', target: 'ignore', planned: false },
    ]);
    expect(f).toEqual({
      summary: 'Usuário sem acesso.',
      actions: 'resetei a senha\nPlanejado: vou validar amanhã',
      observedResult: 'Login ok.',
      pendingItem: 'Aguardando o usuário.',
      expectedAction: 'Enviar o print.',
      questions: 'qual o erro',
    });
  });

  it('prefixo de planejado não é duplicado', () => {
    const f = assembleDraft([{ text: 'Planejado: reiniciar o serviço', target: 'action', planned: true }]);
    expect(f.actions).toBe('Planejado: reiniciar o serviço');
  });
});

describe('medida de acerto em anotações fictícias separadas do treino', () => {
  it('o piso técnico não regride', () => {
    let total = 0;
    let right = 0;
    const wrong: string[] = [];
    for (const c of DRAFT_EVAL) {
      const got = classifyDraft(c.note);
      expect(got.length, c.note).toBe(c.expected.length);
      got.forEach((s, i) => {
        total += 1;
        if (s.predicted === c.expected[i]) right += 1;
        else wrong.push(`${s.text} => ${s.predicted} (esperado ${c.expected[i]})`);
      });
    }
    process.stdout.write(`ACERTO ${right}/${total}\n${wrong.join('\n')}\n`);
    expect(right / total).toBeGreaterThanOrEqual(0.75);
  });

  it('anotações bagunçadas: mede a robustez e deixa o limite à vista', () => {
    let total = 0;
    let right = 0;
    const wrong: string[] = [];
    for (const c of DRAFT_EVAL_HARD) {
      const got = classifyDraft(c.note);
      expect(got.length, c.note).toBe(c.expected.length);
      got.forEach((s, i) => {
        total += 1;
        if (s.predicted === c.expected[i]) right += 1;
        else wrong.push(`${s.text} => ${s.predicted} (esperado ${c.expected[i]})`);
      });
    }
    process.stdout.write(`DIFICIL ${right}/${total}\n${wrong.join('\n')}\n`);
    expect(right / total).toBeGreaterThanOrEqual(0.75);
  });
});
