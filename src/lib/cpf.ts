/**
 * Valida um CPF brasileiro usando o algoritmo oficial dos dígitos verificadores.
 * Remove formatação antes de validar.
 */
export function validarCPF(cpf: string | null | undefined): boolean {
  if (!cpf) return false;
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;

  // Rejeitar CPFs com todos os dígitos iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // Calcular primeiro dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cleaned.charAt(9))) return false;

  // Calcular segundo dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(cleaned.charAt(10))) return false;

  return true;
}

/**
 * Formata CPF para exibição: 123.456.789-00
 */
export function formatarCPF(cpf: string): string {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11) return cpf;
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

/**
 * Remove formatação do CPF, retornando apenas números.
 */
export function limparCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}
