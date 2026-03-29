export function getProjectDir(): string | undefined {
  return localStorage.getItem('projectDir') ?? undefined;
}
