import { RULE_STATUS_LABEL, type RuleStatus } from '../domain/rules/schema';

const AVISO: Record<RuleStatus, string> = {
  validado: 'Conferida por contador.',
  nao_validado: 'Valor ainda não conferido por contador. Use apenas para teste.',
  pendente: 'Regra sem valor cadastrado.',
};

/** Selo visível com o estado de validação da regra usada. */
export function StatusRegra({ status }: { status: RuleStatus }) {
  return (
    <p className={`status status--${status}`}>
      <span className="status__selo">{RULE_STATUS_LABEL[status]}</span> {AVISO[status]}
    </p>
  );
}
