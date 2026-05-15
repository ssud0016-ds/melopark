export const minTapTarget = 44;

export function assertTapTarget(label: string, width: number, height: number) {
  if (__DEV__ && (width < minTapTarget || height < minTapTarget)) {
    console.warn(`${label} is smaller than the ${minTapTarget}dp minimum tap target.`);
  }
}
