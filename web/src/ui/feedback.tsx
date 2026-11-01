import type { ComponentChild, ComponentChildren } from "preact";

import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

export type Tone = "info" | "success" | "warning" | "danger";

export type AlertProps = {
  tone: Tone;
  title?: string;
  children?: ComponentChildren;
  action?: ComponentChild;
};

const TONE_ICONS: Record<Tone, ComponentChild> = {
  info: <InfoIcon />,
  success: <CheckIcon />,
  warning: <AlertIcon />,
  danger: <AlertIcon />,
};

export const Alert = (props: AlertProps) => (
  <div
    class={`alert alert-${props.tone}`}
    role={props.tone === "danger" ? "alert" : "status"}
  >
    <span class="alert-icon">{TONE_ICONS[props.tone]}</span>
    <div class="alert-body">
      {props.title && <strong class="alert-title">{props.title}</strong>}
      {props.children && <div class="alert-text">{props.children}</div>}
    </div>
    {props.action && <div class="alert-action">{props.action}</div>}
  </div>
);

export type BadgeProps = {
  tone?: Tone | "neutral" | "primary";
  children: ComponentChildren;
};

export const Badge = (props: BadgeProps) => (
  <span class={`badge badge-${props.tone ?? "neutral"}`}>{props.children}</span>
);

export type EmptyStateProps = {
  icon: ComponentChild;
  title: string;
  children?: ComponentChildren;
};

export const EmptyState = (props: EmptyStateProps) => (
  <div class="empty-state">
    <span class="icon-tile icon-tile-lg">{props.icon}</span>
    <strong>{props.title}</strong>
    {props.children && <p>{props.children}</p>}
  </div>
);

export type ResultPanelProps = {
  tone: "success" | "danger" | "pending" | "info";
  title: string;
  children?: ComponentChildren;
  actions?: ComponentChild;
};

export const ResultPanel = (props: ResultPanelProps) => (
  <div class="result-panel" role="status">
    <span class={`icon-tile icon-tile-lg icon-tile-${props.tone}`}>
      {props.tone === "pending" ? (
        <span class="spinner spinner-lg" />
      ) : props.tone === "success" ? (
        <CheckIcon size={22} />
      ) : props.tone === "danger" ? (
        <AlertIcon size={22} />
      ) : (
        <InfoIcon size={22} />
      )}
    </span>
    <h2>{props.title}</h2>
    {props.children && <p>{props.children}</p>}
    {props.actions && <div class="result-actions">{props.actions}</div>}
  </div>
);

export type SkeletonProps = {
  lines?: number;
};

export const Skeleton = (props: SkeletonProps) => (
  <div class="skeleton-stack" aria-busy="true" aria-label="Carregando">
    {Array.from({ length: props.lines ?? 3 }, (_, index) => (
      <span key={index} class="skeleton" />
    ))}
  </div>
);

export type CardProps = {
  title?: string;
  description?: ComponentChildren;
  actions?: ComponentChild;
  children?: ComponentChildren;
  class?: string;
  tone?: "default" | "danger";
};

export const Card = (props: CardProps) => (
  <section
    class={`card ${props.tone === "danger" ? "card-danger" : ""} ${props.class ?? ""}`}
  >
    {(props.title || props.actions) && (
      <header class="card-header">
        <div>
          {props.title && <h2 class="card-title">{props.title}</h2>}
          {props.description && (
            <p class="card-description">{props.description}</p>
          )}
        </div>
        {props.actions && <div class="card-actions">{props.actions}</div>}
      </header>
    )}
    {props.children}
  </section>
);
