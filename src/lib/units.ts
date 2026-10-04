/** cm → "5′9″" for a quick feet/inches read on a metric height field. */
export function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches % 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}′${inches}″`;
}
