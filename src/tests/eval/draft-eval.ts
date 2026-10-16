import type { DraftClass } from '../../config/draft-rules';

/**
 * Anotações fictícias, escritas à parte do corpus de treino, com a classe esperada de cada trecho (em ordem).
 * Servem para medir o classificador do rascunho livre. Dados fictícios; nenhum chamado real.
 * Atenção: o analista real escreve de outro jeito. Esta medida é um piso técnico, não a taxa de acerto em produção.
 */
export interface DraftEvalCase {
  note: string;
  expected: DraftClass[];
}

export const DRAFT_EVAL: DraftEvalCase[] = [
  {
    note: 'usuário sem acesso ao sistema de ponto desde segunda.\nresetei a senha e testei o login.\nlogin ok no meu teste.\naguardando o usuário confirmar.',
    expected: ['summary', 'action', 'result', 'pending'],
  },
  {
    note: 'impressora do financeiro não imprime. limpei a fila de impressão. reinstalei o driver. continua sem imprimir. vou trocar o cabo amanhã.',
    expected: ['summary', 'action', 'action', 'result', 'action'],
  },
  {
    note: 'cliente relata erro ao abrir o outlook\nqual mensagem aparece?\nacontece em outro computador?\nprecisamos do print da tela',
    expected: ['summary', 'question', 'question', 'expected'],
  },
  {
    note: 'solicitação de instalação do pacote office no notebook novo\ninstalei o pacote\nverifiquei as licenças\ntudo funcionando normalmente',
    expected: ['summary', 'action', 'action', 'result'],
  },
  {
    note: 'conta bloqueada após tentativas de login\ndesbloqueei a conta no AD\no usuário precisa trocar a senha no primeiro acesso\npendente retorno do usuário',
    expected: ['summary', 'action', 'expected', 'pending'],
  },
  {
    note: 'wi-fi cai na sala 2. troquei o ponto de acesso. a rede ficou estável no teste. falta acompanhar por dois dias.',
    expected: ['summary', 'action', 'result', 'pending'],
  },
  {
    note: 'gestor pede liberação do site de fornecedor\nliberei no proxy\nfavor testar o acesso e responder',
    expected: ['summary', 'action', 'expected'],
  },
  {
    note: 'usuária não consegue salvar na pasta da rede\nconferi as permissões\nmesmo erro de permissão\nencaminhar para a infraestrutura',
    expected: ['summary', 'action', 'result', 'expected'],
  },
  {
    note: 'monitor não é reconhecido pelo computador\ntroquei o cabo hdmi\no monitor ainda não é detectado\naguardando peça de reposição',
    expected: ['summary', 'action', 'result', 'pending'],
  },
  {
    note: 'teams sem câmera nas reuniões\nhabilitei a câmera nas configurações\no problema não ocorre mais\nconfirmar com o usuário se voltou a funcionar',
    expected: ['summary', 'action', 'result', 'expected'],
  },
  {
    note: 'relato de lentidão no sistema financeiro\nquando o problema começou?\nacontece em todos os horários?\naguardando resposta do usuário',
    expected: ['summary', 'question', 'question', 'pending'],
  },
  {
    note: 'notebook reinicia sozinho\natualizei a bios\nreiniciou duas vezes durante o teste\nvamos substituir a bateria',
    expected: ['summary', 'action', 'result', 'action'],
  },
];

/** Anotações mais bagunçadas: abreviações, sem verbo claro, mistura de assuntos. Medem a robustez, não o caso feliz. */
export const DRAFT_EVAL_HARD: DraftEvalCase[] = [
  {
    note: 'SAP lento\nliguei pro usuário às 10h\nele disse que travou de novo\nreboot feito\nacompanhar até sexta',
    expected: ['summary', 'action', 'result', 'action', 'pending'],
  },
  {
    note: 'acesso negado na pasta RH\nadicionei o usuário no grupo\nagora abre\nobs: usuário novo no setor',
    expected: ['summary', 'action', 'result', 'summary'],
  },
  {
    note: 'não imprime\nfila travada\nlimpei a fila\nimprimiu',
    expected: ['summary', 'result', 'action', 'result'],
  },
  {
    note: 'pedido de nova senha do portal\ngerada senha temporária\nusuário deve trocar no primeiro login',
    expected: ['summary', 'action', 'expected'],
  },
  {
    note: 'internet lenta no 2º andar\ntestei com cabo, velocidade normal\nwifi com problema\nencaminhar para redes',
    expected: ['summary', 'action', 'result', 'expected'],
  },
  {
    note: 'bloqueio no firewall\nregra criada\nteste ok\nfalta o usuário validar',
    expected: ['summary', 'action', 'result', 'pending'],
  },
];
