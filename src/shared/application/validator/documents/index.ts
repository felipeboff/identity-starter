import { formatValidCnpj } from "./cnpj";
import { formatValidCpf } from "./cpf";

export { formatValidCnpj } from "./cnpj";
export { formatValidCpf } from "./cpf";

export const formatValidCpfOrCnpj = (
  value: string | null | undefined,
): string | null => {
  const cpf = formatValidCpf(value);
  if (cpf != null) return cpf;

  return formatValidCnpj(value);
};
