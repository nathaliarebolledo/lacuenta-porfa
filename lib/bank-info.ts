export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Cuenta corriente',
  vista: 'Cuenta vista',
  savings: 'Cuenta de ahorro',
  other: 'Otra',
};

export type BankInfo = {
  full_name?: string | null;
  email?: string | null;
  bank_name?: string | null;
  account_type?: string | null;
  account_number?: string | null;
  rut_or_reference?: string | null;
};

export function hasBankInfo(bank: BankInfo) {
  return Boolean(bank.bank_name || bank.account_number);
}

export function formatBankInfoText(bank: BankInfo) {
  return [
    bank.full_name,
    bank.rut_or_reference ? `RUT: ${bank.rut_or_reference}` : null,
    bank.email ? `Correo: ${bank.email}` : null,
    bank.bank_name ? `Banco: ${bank.bank_name}` : null,
    bank.account_type ? ACCOUNT_TYPE_LABELS[bank.account_type] ?? bank.account_type : null,
    bank.account_number ? `N° ${bank.account_number}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
