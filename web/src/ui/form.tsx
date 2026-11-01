import {
  createContext,
  type ComponentChild,
  type ComponentChildren,
  type TargetedSubmitEvent,
} from "preact";
import { useContext, useId, useState } from "preact/hooks";

import { ApiError } from "../api/api-error";
import { errorMessages } from "../services";

import { Button, type ButtonProps } from "./button";
import { Alert } from "./feedback";
import { EyeIcon, EyeOffIcon } from "./icons";

export type FieldErrors = Record<string, string>;

export class FormValues {
  constructor(private readonly data: FormData) {}

  text(name: string): string {
    const value = this.data.get(name);
    return typeof value === "string" ? value : "";
  }

  list(name: string): string[] {
    return this.data
      .getAll(name)
      .filter((value): value is string => typeof value === "string");
  }
}

export class FieldErrorsThrown extends Error {
  constructor(readonly errors: FieldErrors) {
    super("Invalid fields");
  }
}

type ValidatableElement =
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export class FieldValidator {
  validate(form: HTMLFormElement): FieldErrors {
    const errors: FieldErrors = {};
    for (const element of Array.from(form.elements)) {
      if (
        !this.isValidatable(element) ||
        !element.name ||
        errors[element.name]
      ) {
        continue;
      }
      const message = this.messageOf(element);
      if (message) errors[element.name] = message;
    }
    return errors;
  }

  fromFailure(error: unknown, form: HTMLFormElement): FieldErrors {
    if (error instanceof FieldErrorsThrown) return error.errors;
    if (!(error instanceof ApiError)) return {};
    const errors: FieldErrors = {};
    for (const violation of error.violations) {
      const field = violation.field.split(".")[0] ?? violation.field;
      if (form.elements.namedItem(field)) {
        errors[field] ??= errorMessages.describeViolation(violation);
      }
    }
    return errors;
  }

  private messageOf(element: ValidatableElement): string | null {
    const value = element.value;
    if (element.required && value.trim() === "") return "Preencha este campo.";
    if (value === "") return null;
    if (element instanceof HTMLInputElement) {
      if (element.minLength > 0 && value.length < element.minLength) {
        return `Use pelo menos ${element.minLength} caracteres.`;
      }
      if (element.validity.typeMismatch && element.type === "email") {
        return "Digite um e-mail válido.";
      }
      if (element.validity.patternMismatch) {
        return element.title || "Formato inválido.";
      }
    }
    return element.validity.valid ? null : element.validationMessage;
  }

  private isValidatable(element: Element): element is ValidatableElement {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    );
  }
}

const fieldValidator = new FieldValidator();

type FormContextValue = {
  pending: boolean;
  errors: FieldErrors;
};

const FormContext = createContext<FormContextValue>({
  pending: false,
  errors: {},
});

export type FormProps = {
  action: (values: FormValues) => Promise<unknown>;
  children: ComponentChildren;
  class?: string;
  resetOnSuccess?: boolean;
};

export const Form = (props: FormProps) => {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (event: TargetedSubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const invalid = fieldValidator.validate(form);
    setFailure(null);
    setErrors(invalid);
    if (Object.keys(invalid).length > 0) {
      form
        .querySelector<HTMLElement>(`[name="${Object.keys(invalid)[0]}"]`)
        ?.focus();
      return;
    }

    setPending(true);
    try {
      await props.action(new FormValues(new FormData(form)));
      if (props.resetOnSuccess) form.reset();
    } catch (error) {
      setErrors(fieldValidator.fromFailure(error, form));
      if (!(error instanceof FieldErrorsThrown)) {
        setFailure(errorMessages.describe(error));
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      class={`form ${props.class ?? ""}`}
      noValidate
      onSubmit={submit}
      onInput={(event) => {
        const name = (event.target as HTMLInputElement).name;
        if (name && errors[name]) {
          setErrors((current) => {
            const next = { ...current };
            delete next[name];
            return next;
          });
        }
      }}
    >
      <FormContext.Provider value={{ pending, errors }}>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <fieldset class="form-fieldset" disabled={pending}>
          {props.children}
        </fieldset>
      </FormContext.Provider>
    </form>
  );
};

export const useFormState = (): FormContextValue => useContext(FormContext);

type FieldShellProps = {
  id: string;
  name: string;
  label: string;
  hint?: ComponentChildren;
  aside?: ComponentChild;
  children: ComponentChildren;
};

const FieldShell = (props: FieldShellProps) => {
  const error = useFormState().errors[props.name];
  return (
    <div class={`field ${error ? "is-invalid" : ""}`}>
      <div class="field-label-row">
        <label for={props.id}>{props.label}</label>
        {props.aside}
      </div>
      {props.children}
      {error ? (
        <p class="field-message field-error" id={`${props.id}-message`}>
          {error}
        </p>
      ) : (
        props.hint && (
          <p class="field-message" id={`${props.id}-message`}>
            {props.hint}
          </p>
        )
      )}
    </div>
  );
};

export type FieldProps = {
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "search";
  autocomplete?: string;
  placeholder?: string;
  hint?: ComponentChildren;
  aside?: ComponentChild;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  defaultValue?: string;
  autoFocus?: boolean;
  mono?: boolean;
};

export const Field = (props: FieldProps) => {
  const id = useId();
  const invalid = Boolean(useFormState().errors[props.name]);
  return (
    <FieldShell
      id={id}
      name={props.name}
      label={props.label}
      hint={props.hint}
      aside={props.aside}
    >
      <input
        id={id}
        class={`input ${props.mono ? "input-mono" : ""}`}
        name={props.name}
        type={(props.type ?? "text") as "text"}
        autocomplete={props.autocomplete}
        placeholder={props.placeholder}
        required={props.required}
        minLength={props.minLength}
        maxLength={props.maxLength}
        pattern={props.pattern}
        title={props.patternMessage}
        defaultValue={props.defaultValue}
        autoFocus={props.autoFocus}
        aria-invalid={invalid}
        aria-describedby={`${id}-message`}
      />
    </FieldShell>
  );
};

export const PasswordField = (props: FieldProps) => {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const invalid = Boolean(useFormState().errors[props.name]);
  return (
    <FieldShell
      id={id}
      name={props.name}
      label={props.label}
      hint={props.hint}
      aside={props.aside}
    >
      <div class="input-group">
        <input
          id={id}
          class="input"
          name={props.name}
          type={(visible ? "text" : "password") as "text"}
          autocomplete={props.autocomplete}
          placeholder={props.placeholder ?? "••••••••••••"}
          required={props.required}
          minLength={props.minLength}
          maxLength={props.maxLength}
          autoFocus={props.autoFocus}
          aria-invalid={invalid}
          aria-describedby={`${id}-message`}
        />
        <button
          type="button"
          class="input-addon"
          aria-label={visible ? "Esconder senha" : "Mostrar senha"}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </FieldShell>
  );
};

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectFieldProps = {
  label: string;
  name: string;
  options: readonly SelectOption[];
  defaultValue?: string;
  hint?: ComponentChildren;
};

export const SelectField = (props: SelectFieldProps) => {
  const id = useId();
  return (
    <FieldShell id={id} name={props.name} label={props.label} hint={props.hint}>
      <select id={id} class="input select" name={props.name}>
        {props.options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            selected={option.value === props.defaultValue}
          >
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
};

export type CheckboxGroupProps = {
  label: string;
  name: string;
  options: readonly SelectOption[];
  defaultValues?: readonly string[];
  lockedValues?: readonly string[];
  lockedTitle?: string;
  hint?: ComponentChildren;
  emptyMessage?: string;
};

export const CheckboxGroup = (props: CheckboxGroupProps) => {
  const error = useFormState().errors[props.name];
  return (
    <fieldset class={`field checkbox-group ${error ? "is-invalid" : ""}`}>
      <legend>{props.label}</legend>
      {props.options.length === 0 && (
        <p class="field-message">{props.emptyMessage ?? "Nenhuma opção."}</p>
      )}
      <div class="checkbox-grid">
        {props.options.map((option) => {
          const checked = props.defaultValues?.includes(option.value);
          const locked = props.lockedValues?.includes(option.value);
          return (
            <label
              key={option.value}
              class={`checkbox ${locked ? "is-locked" : ""}`}
              title={locked ? props.lockedTitle : undefined}
            >
              <input
                type="checkbox"
                name={props.name}
                value={option.value}
                defaultChecked={checked}
                disabled={locked}
              />
              <span class="checkbox-box" aria-hidden="true" />
              <span>{option.label}</span>
              {locked && checked && (
                <input type="hidden" name={props.name} value={option.value} />
              )}
            </label>
          );
        })}
      </div>
      {error ? (
        <p class="field-message field-error">{error}</p>
      ) : (
        props.hint && <p class="field-message">{props.hint}</p>
      )}
    </fieldset>
  );
};

export const SubmitButton = (props: ButtonProps) => {
  const pending = useFormState().pending;
  return (
    <Button
      {...props}
      type="submit"
      variant={props.variant ?? "primary"}
      pending={pending}
    />
  );
};
