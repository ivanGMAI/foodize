export const formatPhoneNumber = (value) => {
  if (!value) return '';
  let cleanValue = value.replace(/\D/g, '');

  if (cleanValue.startsWith('8')) {
    cleanValue = '7' + cleanValue.slice(1);
  }

  if (!cleanValue.startsWith('7') && cleanValue.length > 0) {
    cleanValue = '7' + cleanValue;
  }

  let formatted = '';
  if (cleanValue.length > 0) {
    formatted += '+' + cleanValue[0];
  }
  if (cleanValue.length > 1) {
    formatted += ' (' + cleanValue.slice(1, 4);
  }
  if (cleanValue.length > 4) {
    formatted += ') ' + cleanValue.slice(4, 7);
  }
  if (cleanValue.length > 7) {
    formatted += '-' + cleanValue.slice(7, 9);
  }
  if (cleanValue.length > 9) {
    formatted += '-' + cleanValue.slice(9, 11);
  }

  return formatted;
};

export const extractPhoneNumber = (value) => {
  return '+' + value.replace(/\D/g, '');
};
