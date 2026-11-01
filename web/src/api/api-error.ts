export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  code: string;
  data?: unknown;
};

export type Violation = {
  field: string;
  reason: string;
};

type ProblemData = {
  violations?: Violation[];
  retryAfterSeconds?: number;
  required?: string;
  anyOf?: string[];
};

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.title);
  }

  get status(): number {
    return this.problem.status;
  }

  get code(): string {
    return this.problem.code;
  }

  get violations(): Violation[] {
    return this.data.violations ?? [];
  }

  get retryAfterSeconds(): number | null {
    return this.data.retryAfterSeconds ?? null;
  }

  get requiredPermissions(): string[] {
    if (this.data.required) return [this.data.required];
    return this.data.anyOf ?? [];
  }

  private get data(): ProblemData {
    const data = this.problem.data;
    return typeof data === "object" && data !== null ? data : {};
  }
}
