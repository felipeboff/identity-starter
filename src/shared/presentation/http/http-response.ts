export type HttpResponse = Readonly<{
  status: number;
  body?: unknown;
  headers?: Readonly<Record<string, string>>;
}>;

/** RFC 9457 */
export type ProblemDetails = Readonly<{
  type: string;
  title: string;
  status: number;
  code: string;
  data?: unknown;
}>;
