import { formatValidCnpj, formatValidCpf, formatValidCpfOrCnpj } from '../documents';
import { failure, resolveInput, result, runRefinements } from '../internal/helpers';
import type { BaseOptions, ParseResult, Schema } from '../types';

export type DocumentOptions = BaseOptions<string> & {
  empty?: boolean;
};

export type CpfOptions = DocumentOptions;
export type CnpjOptions = DocumentOptions;
export type CpfCnpjOptions = DocumentOptions;

const parseDocument = (
  input: unknown,
  options: DocumentOptions | undefined,
  invalidReason: 'invalid_cpf' | 'invalid_cnpj' | 'invalid_cpf_cnpj',
  format: (value: string) => string | null
): ParseResult<string> => {
  const resolved = resolveInput(input, options);
  if (resolved.done) return resolved.result;
  if (typeof resolved.value !== 'string') return failure(invalidReason);

  const allowEmpty = options?.empty === true && resolved.value.trim() === '';
  let value = allowEmpty ? '' : format(resolved.value);
  if (value === null) return failure(invalidReason);
  if (options?.transform) value = options.transform(value);

  return result(value, runRefinements(value, options?.refine));
};

export const cpf = (options?: CpfOptions): Schema<string> => ({
  parse: (input) => parseDocument(input, options, 'invalid_cpf', formatValidCpf),
});

export const cnpj = (options?: CnpjOptions): Schema<string> => ({
  parse: (input) => parseDocument(input, options, 'invalid_cnpj', formatValidCnpj),
});

export const cpfCnpj = (options?: CpfCnpjOptions): Schema<string> => ({
  parse: (input) => parseDocument(input, options, 'invalid_cpf_cnpj', formatValidCpfOrCnpj),
});
