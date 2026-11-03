export class DomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
    readonly details?: { field: string; issue: string }[],
  ) {
    super(message);
    this.name = 'DomainException';
  }
}
