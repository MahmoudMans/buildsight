const CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const SENTENCE_CODE = /\b[A-Z]{2,}(?:_[A-Z]+)+\b/g;

/**
 * A status code such as AT_RISK or FOR_REVIEW becomes "At risk" or "For review".
 * Text that is not a code is returned as it is, so it is safe to use on any value.
 */
export function codeLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (!CODE.test(value)) {
    return value;
  }

  const text = value.toLowerCase().replace(/_/g, " ");

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Codes written inside a sentence by the backend ("... is AT_RISK ...") become plain words ("... is at risk ...").
 */
export function plainCodes(text: string | null | undefined): string {
  if (!text) {
    return "";
  }

  return text.replace(SENTENCE_CODE, (match, offset: number, whole: string) => {
    const words = match.toLowerCase().replace(/_/g, " ");
    const before = whole.slice(0, offset).trimEnd();

    return before === "" || /[.!?:]$/.test(before) ? words.charAt(0).toUpperCase() + words.slice(1) : words;
  });
}

/**
 * A cost that can come out negative. A negative figure is a net saving, so it reads "€40,285 saving" instead of "-€40,285".
 */
export function netCost(value: number, format: (amount: number) => string): string {
  const rounded = Math.round(value);

  if (rounded < 0) {
    return `${format(-value)} saving`;
  }

  return format(rounded === 0 ? 0 : value);
}
