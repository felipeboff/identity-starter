import {
  array,
  bigint,
  boolean,
  cnpj,
  cpf,
  cpfCnpj,
  date,
  email,
  enumValue,
  number,
  object,
  objectId,
  string,
  uuid,
} from './schemas';

export type * from './types';
export type {
  ArrayOptions,
  BigIntOptions,
  BooleanOptions,
  CnpjOptions,
  CpfCnpjOptions,
  CpfOptions,
  DateOptions,
  DocumentOptions,
  EmailOptions,
  EnumOptions,
  FormatOptions,
  NumberOptions,
  ObjectIdOptions,
  ObjectOptions,
  StringOptions,
  UuidOptions,
} from './schemas';

export { formatValidCnpj, formatValidCpf, formatValidCpfOrCnpj } from './documents';

export { array, bigint, boolean, cnpj, cpf, cpfCnpj, date, email, enumValue, number, object, objectId, string, uuid };

export const v = {
  string,
  number,
  bigint,
  boolean,
  date,
  email,
  uuid,
  objectId,
  cpf,
  cnpj,
  cpfCnpj,
  enum: enumValue,
  array,
  object,
};
