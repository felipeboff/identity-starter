import type { ComponentChild, ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";

import { appHistory } from "./history";

export type RouteParams = Record<string, string>;

export type RouteAccess = "guest" | "member" | "any";

export type RouteDefinition = {
  pattern: string;
  access: RouteAccess;
  render: (params: RouteParams) => ComponentChild;
};

export type RouteMatch = {
  route: RouteDefinition;
  params: RouteParams;
};

export class RouteTable {
  constructor(private readonly routes: readonly RouteDefinition[]) {}

  match(pathname: string): RouteMatch | null {
    for (const route of this.routes) {
      const params = this.paramsOf(route.pattern, pathname);
      if (params) return { route, params };
    }
    return null;
  }

  private paramsOf(pattern: string, pathname: string): RouteParams | null {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    const expected = pattern.split("/");
    const actual = path.split("/");
    if (expected.length !== actual.length) return null;

    const params: RouteParams = {};
    for (const [index, segment] of expected.entries()) {
      const value = actual[index] ?? "";
      if (segment.startsWith(":"))
        params[segment.slice(1)] = decodeURIComponent(value);
      else if (segment !== value) return null;
    }
    return params;
  }
}

export type LinkProps = {
  href: string;
  class?: string;
  children: ComponentChildren;
  ariaCurrent?: boolean;
};

export const Link = (props: LinkProps) => (
  <a
    href={props.href}
    class={props.class}
    aria-current={props.ariaCurrent ? "page" : undefined}
    onClick={(event) => {
      const modified =
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
      if (modified || event.button !== 0) return;
      event.preventDefault();
      appHistory.push(props.href);
    }}
  >
    {props.children}
  </a>
);

export type RedirectProps = {
  to: string;
};

export const Redirect = (props: RedirectProps) => {
  useEffect(() => appHistory.replace(props.to), [props.to]);
  return null;
};
