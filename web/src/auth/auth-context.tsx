import { createContext, type ComponentChildren } from "preact";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { ApiError } from "../api/api-error";
import type { Me, Permission, SessionTokens } from "../api/identity.types";
import { errorMessages, identityApi, tokenStore } from "../services";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out"; notice: string | null }
  | { status: "signed-in"; me: Me };

export type AuthContextValue = {
  state: AuthState;
  me: Me | null;
  notice: string | null;
  startSession: (tokens: SessionTokens) => Promise<void>;
  reloadMe: () => Promise<void>;
  signOut: () => Promise<void>;
  endLocally: (notice: string | null) => void;
  can: (permission: Permission) => boolean;
};

const SESSION_ENDED_NOTICE = "Sua sessão terminou. Entre de novo.";

const AuthContext = createContext<AuthContextValue | null>(null);

export type AuthProviderProps = {
  children: ComponentChildren;
};

export const AuthProvider = (props: AuthProviderProps) => {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(async () => {
    if (!tokenStore.read()) {
      setState({ status: "signed-out", notice: null });
      return;
    }
    try {
      const me = await identityApi.getMe();
      setState({ status: "signed-in", me });
    } catch (error) {
      const expired = error instanceof ApiError && error.status === 401;
      if (expired) tokenStore.clear();
      setState({
        status: "signed-out",
        notice: expired ? SESSION_ENDED_NOTICE : errorMessages.describe(error),
      });
    }
  }, []);

  useEffect(() => {
    void load();
    return tokenStore.subscribe((tokens, origin) => {
      if (!tokens) {
        setState((current) =>
          current.status === "signed-in"
            ? { status: "signed-out", notice: SESSION_ENDED_NOTICE }
            : current,
        );
      }
      if (
        tokens &&
        origin === "other-tab" &&
        stateRef.current.status === "signed-out"
      ) {
        void load();
      }
    });
  }, [load]);

  const startSession = useCallback(async (tokens: SessionTokens) => {
    tokenStore.save(tokens);
    const me = await identityApi.getMe();
    setState({ status: "signed-in", me });
  }, []);

  const reloadMe = useCallback(async () => {
    const me = await identityApi.getMe();
    setState({ status: "signed-in", me });
  }, []);

  const endLocally = useCallback((notice: string | null) => {
    setState({ status: "signed-out", notice });
    tokenStore.clear();
  }, []);

  const signOut = useCallback(async () => {
    try {
      await identityApi.signOut();
    } finally {
      endLocally(null);
    }
  }, [endLocally]);

  const value = useMemo<AuthContextValue>(() => {
    const me = state.status === "signed-in" ? state.me : null;
    return {
      state,
      me,
      notice: state.status === "signed-out" ? state.notice : null,
      startSession,
      reloadMe,
      signOut,
      endLocally,
      can: (permission) =>
        me?.membership.permissions.includes(permission) ?? false,
    };
  }, [state, startSession, reloadMe, signOut, endLocally]);

  return (
    <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
};

export const useMe = (): Me => {
  const me = useAuth().me;
  if (!me) throw new Error("useMe must be used on a signed-in page");
  return me;
};
