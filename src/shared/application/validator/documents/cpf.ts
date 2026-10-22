const stripCpfDigits = (input: string | null | undefined): string => {
  if (input == null) return "";
  return input.trim().replace(/\D/g, "");
};

const formatCpf = (cpf: string): string => {
  const part1 = cpf.slice(0, 3);
  const part2 = cpf.slice(3, 6);
  const part3 = cpf.slice(6, 9);
  const part4 = cpf.slice(9, 11);
  return `${part1}.${part2}.${part3}-${part4}`;
};

const validateCpfDigit = (cpf: string, offset = 0): boolean => {
  const firstDigits = cpf
    .slice(0, 9 + offset)
    .split("")
    .map((e) => Number.parseInt(e, 10));

  const lastDigits = cpf
    .slice(9, 11)
    .split("")
    .map((e) => Number.parseInt(e, 10));

  const sequence = firstDigits.length + 1;

  let sum = 0;
  for (let i = 0; i < firstDigits.length; i++) {
    sum += firstDigits[i] * (sequence - i);
  }

  const modulus = (sum * 10) % 11;
  const expectedDigit = modulus === 10 ? 0 : modulus;

  return lastDigits[offset] === expectedDigit;
};

export const formatValidCpf = (
  value: string | null | undefined,
): string | null => {
  const clean = stripCpfDigits(value);

  if (clean.length !== 11) return null;

  if (/^(\d)\1{10}$/.test(clean)) {
    return null;
  }

  if (!validateCpfDigit(clean)) return null;
  if (!validateCpfDigit(clean, 1)) return null;

  return formatCpf(clean);
};
