/** Erro de API com status HTTP e código; o jogo traduz o código (ui/arenaClient.ts, `ERROR_TEXT`). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: unknown,
  ) {
    super(code);
  }
}
