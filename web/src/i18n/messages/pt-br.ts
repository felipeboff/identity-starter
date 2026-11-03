import type { Permission, Role } from "../../api/identity.types";
import type {
  QueryName,
  RateLimit,
  RateLimitScope,
  RateLimitWindow,
  RouteGroup,
  RouteId,
} from "../../explorer/route-catalog";

import type { Messages, RouteCopy } from "./en";

const errorCodes: Record<string, string> = {
  "client.network_failed":
    "Não foi possível falar com a API. Confira se ela está no ar.",
  "client.unexpected_response": "A API respondeu algo inesperado.",
  "client.oauth_cancelled": "O provedor cancelou ou recusou o login.",
  "client.oauth_unrecognized":
    "Não reconhecemos esta tentativa de login. Comece de novo por aqui.",
  "client.oauth_incomplete": "A resposta do provedor veio incompleta.",
  "shared.input_invalid": "Confira os campos destacados.",
  "shared.body_malformed": "A requisição saiu malformada.",
  "shared.rate_limited": "Muitas tentativas. Tente de novo em {seconds} s.",
  "shared.permission_missing": "Você não tem permissão para fazer isso.",
  "shared.version_conflict":
    "Os dados mudaram enquanto você editava. Recarregue e tente de novo.",
  "shared.already_exists": "Esse registro já existe.",
  "shared.route_not_found": "Essa rota não existe na API.",
  "shared.internal": "Algo deu errado do nosso lado. Tente de novo.",
  "identity.invalid_credentials": "E-mail ou senha incorretos.",
  "identity.sign_in_locked":
    "Muitas tentativas para esse e-mail. Tente de novo em {seconds} s.",
  "identity.account_email_taken": "Já existe uma conta com esse e-mail.",
  "identity.credential_email_taken": "Já existe uma conta com esse e-mail.",
  "identity.account_deleted": "Esta conta está desativada.",
  "identity.account_not_found": "Conta não encontrada.",
  "identity.account_email_already_verified": "Seu e-mail já está confirmado.",
  "identity.credential_not_found":
    "Não há um login com esse provedor nesta conta.",
  "identity.credential_password_not_set":
    "Esta conta entra só com GitHub ou Google.",
  "identity.email_change_needs_password":
    "Contas que entram só com GitHub ou Google não podem trocar o e-mail.",
  "identity.email_change_expired": "O link de troca de e-mail expirou.",
  "identity.email_change_already_consumed":
    "Esse link de troca de e-mail já foi usado.",
  "identity.email_change_deleted": "Essa troca de e-mail foi cancelada.",
  "identity.invalid_email_change_token": "Link de troca de e-mail inválido.",
  "identity.email_verification_expired":
    "O link de confirmação expirou. Peça um novo.",
  "identity.email_verification_already_consumed":
    "Esse link de confirmação já foi usado.",
  "identity.email_verification_deleted":
    "Esse link de confirmação foi cancelado.",
  "identity.invalid_email_verification_token": "Link de confirmação inválido.",
  "identity.email_delivery_failed":
    "Não conseguimos enviar o e-mail agora. Tente de novo em instantes.",
  "identity.forbidden": "Você não pode fazer isso com essa conta.",
  "identity.invalid_access_token":
    "Token de acesso ausente, inválido ou expirado.",
  "identity.invalid_refresh_token": "Sua sessão expirou. Entre de novo.",
  "identity.refresh_token_reused":
    "Por segurança, todas as sessões foram encerradas. Entre de novo.",
  "identity.session_expired": "Sua sessão expirou. Entre de novo.",
  "identity.session_revoked": "Esta sessão foi encerrada. Entre de novo.",
  "identity.session_not_found": "Sessão não encontrada.",
  "identity.invalid_invitation_token": "Este convite é inválido.",
  "identity.invitation_expired": "Este convite expirou. Peça um novo.",
  "identity.invitation_already_accepted": "Este convite já foi aceito.",
  "identity.invitation_revoked": "Este convite foi revogado.",
  "identity.invitation_not_found": "Convite não encontrado.",
  "identity.invalid_password_reset_token": "Link de redefinição inválido.",
  "identity.password_reset_expired":
    "O link de redefinição expirou. Peça um novo.",
  "identity.password_reset_already_consumed":
    "Esse link de redefinição já foi usado.",
  "identity.password_reset_deleted": "Esse link de redefinição foi cancelado.",
  "identity.last_credential_cannot_be_removed":
    "Esse é o único jeito de entrar na sua conta; não dá para desconectar.",
  "identity.membership_not_found": "Membro não encontrado.",
  "identity.membership_deleted": "Este membro foi removido.",
  "identity.invalid_membership_permissions": "Permissões inválidas.",
  "identity.invalid_membership_role": "Papel inválido.",
  "identity.oauth_code_rejected":
    "O provedor recusou o código. Tente entrar de novo.",
  "identity.oauth_email_not_verified":
    "Seu e-mail no provedor ainda não foi verificado.",
  "identity.oauth_linked_to_another_account":
    "Essa conta do provedor já está ligada a outro usuário.",
  "identity.oauth_provider_already_linked": "Esse provedor já está conectado.",
  "identity.oauth_provider_failed": "O provedor não respondeu. Tente de novo.",
  "identity.oauth_provider_not_supported": "Provedor não suportado.",
};

const violationReasons: Record<string, string> = {
  required: "Preencha este campo.",
  format: "Formato inválido.",
  pattern: "Formato inválido.",
  enum: "Valor não permitido.",
  type: "Valor inválido.",
  minLength: "Muito curto.",
  maxLength: "Muito longo.",
};

const permissions: Record<Permission, string> = {
  "identity.invitation.create": "Criar convites",
  "identity.invitation.read": "Ver convites",
  "identity.invitation.revoke": "Revogar convites",
  "identity.account.reactivate": "Reativar contas",
  "identity.account.deactivate": "Desativar contas",
  "identity.session.read": "Ver sessões de outros",
  "identity.session.revoke": "Encerrar sessões de outros",
  "identity.session.revoke_all": "Encerrar todas as sessões de uma conta",
  "identity.member.read": "Ver membros",
  "identity.member.role.update": "Alterar papel de membros",
  "identity.member.permissions.update": "Alterar permissões de membros",
};

const roles: Record<Role, string> = {
  user: "Usuário",
  admin: "Administrador",
};

const routeGroups: Record<RouteGroup, string> = {
  auth: "Autenticação",
  account: "Minha conta",
  sessions: "Sessões",
  members: "Contas e membros",
  invitations: "Convites",
};

const someoneElsesAccount = "Na conta de outra pessoa exige a permissão.";

const routes: Record<RouteId, RouteCopy> = {
  "sign-up": {
    summary: "Cria uma conta com e-mail e senha e já abre uma sessão.",
    note: "Os tokens da resposta viram a sessão deste navegador.",
  },
  "sign-in": {
    summary: "Entra com e-mail e senha.",
    note: "Sem a senha certa, toda falha é o mesmo 401, exista a conta ou não. 5 falhas para o mesmo e-mail em 15 min bloqueiam o login dele.",
  },
  "oauth-sign-in": {
    summary: "Troca o código do GitHub ou do Google por uma sessão.",
    note: "O código vem do redirecionamento do provedor e só vale uma vez.",
  },
  refresh: {
    summary: "Gira o refresh token e devolve um par novo.",
    note: "Reenviar um token já girado é tratado como roubo: todas as sessões caem.",
  },
  "password-reset-request": {
    summary: "Envia um link de redefinição de senha.",
    note: "Vale para qualquer conta ativa, com ou sem senha: o link cria a senha se não houver. Responde 204 mesmo sem conta.",
  },
  "password-reset": {
    summary: "Troca a senha com o token do e-mail e encerra as sessões.",
  },
  "email-verification": {
    summary: "Confirma o e-mail com o token do link.",
  },
  "accept-invitation": {
    summary: "Aceita um convite, cria a conta já confirmada e entra.",
  },
  "confirm-email-change": {
    summary: "Confirma a troca de e-mail e encerra todas as sessões.",
  },
  "sign-out": {
    summary: "Encerra a sessão atual.",
  },
  "get-me": {
    summary: "Devolve a conta e a membership de quem chama.",
  },
  "update-name": {
    summary: "Atualiza o nome.",
  },
  "change-password": {
    summary: "Troca a senha e encerra todas as sessões, inclusive esta.",
  },
  "request-email-change": {
    summary: "Manda um link de 1 hora para o e-mail novo.",
  },
  "request-email-verification": {
    summary: "Reenvia o link de confirmação de e-mail.",
  },
  "list-credentials": {
    summary: "Formas de entrar da conta: senha e provedores conectados.",
  },
  "link-oauth": {
    summary: "Liga um provedor à conta com um código do OAuth.",
  },
  "unlink-oauth": {
    summary: "Desliga um provedor; recusa se for o único jeito de entrar.",
  },
  "list-sessions": {
    summary: "Sessões ativas, da mais nova para a mais antiga.",
  },
  "revoke-other-sessions": {
    summary: "Encerra todas as sessões menos a atual.",
  },
  "revoke-session": {
    summary: "Encerra uma sessão.",
    note: "Na sessão de outra pessoa exige a permissão.",
  },
  "list-account-sessions": {
    summary: "Sessões ativas de uma conta, da mais nova para a mais antiga.",
    note: someoneElsesAccount,
  },
  "revoke-all-sessions": {
    summary: "Encerra todas as sessões de uma conta.",
    note: someoneElsesAccount,
  },
  "deactivate-account": {
    summary: "Desativa a conta e encerra as sessões dela.",
    note: someoneElsesAccount,
  },
  "reactivate-account": {
    summary: "Reativa uma conta desativada.",
  },
  "list-members": {
    summary: "Membros com conta e membership, página por página.",
    note: "Mande o nextCursor da resposta em cursor para a próxima página.",
  },
  "update-member-role": {
    summary: "Troca o papel de um membro. Ninguém troca o próprio.",
  },
  "update-member-permissions": {
    summary: "Substitui as permissões de um membro. Só concede o que você tem.",
  },
  "invite-member": {
    summary: "Convida por e-mail com papel e permissões.",
  },
  "list-invitations": {
    summary: "Convites pendentes, do mais novo para o mais antigo.",
  },
  "revoke-invitation": {
    summary: "Revoga um convite pendente; um aceito responde 422.",
  },
  "list-permissions": {
    summary:
      "Todos os códigos de permissão que podem ser concedidos, em ordem alfabética.",
  },
};

const queryHints: Record<QueryName, string> = {
  limit: "1 a 100; padrão 50",
  cursor: "nextCursor da página anterior",
};

const rateWindows: Record<RateLimitWindow, string> = {
  hour: "por hora",
  "quarter-hour": "a cada 15 min",
};

const rateScopes: Record<RateLimitScope, string> = {
  ip: "por IP",
  email: "por e-mail",
};

export const ptBr: Messages = {
  common: {
    loading: "Carregando",
    cancel: "Cancelar",
    copy: "Copiar",
    copyLabel: (label) => `Copiar ${label}`,
    close: "Fechar",
    save: "Salvar",
    back: "Voltar",
    signIn: "Entrar",
    signUp: "Criar conta",
    signOut: "Sair",
    language: "Idioma",
    yourName: "Seu nome",
    yourEmail: "Seu e-mail",
    emailPlaceholder: "voce@exemplo.com",
    email: "E-mail",
    password: "Senha",
    currentPassword: "Senha atual",
    newPassword: "Senha nova",
    passwordLength: (min, max) => `De ${min} a ${max} caracteres.`,
    incompleteLink: "Link incompleto",
    openLinkAsReceived: "Abra o link exatamente como chegou no e-mail.",
    linkSent: "Link enviado",
    accountDeactivated: "Sua conta foi desativada.",
    accountId: "ID da conta",
    memberSince: "Membro desde",
  },
  nav: {
    main: "Principal",
    overview: "Visão geral",
    profile: "Perfil",
    security: "Segurança",
    invitations: "Convites",
    members: "Membros",
    explorer: "Explorador de rotas",
  },
  authLayout: {
    eyebrow: (app) => `Com o ${app}`,
    tagline: "Sua conta, suas sessões e seu time em um só lugar",
    exploreRoutes: "Explorar as rotas da API",
  },
  auth: {
    sessionEnded: "Sua sessão terminou. Entre de novo.",
  },
  form: {
    required: "Preencha este campo.",
    minLength: (min) => `Use pelo menos ${min} caracteres.`,
    invalidEmail: "Digite um e-mail válido.",
    invalidFormat: "Formato inválido.",
    showPassword: "Mostrar senha",
    hidePassword: "Esconder senha",
    noOptions: "Nenhuma opção.",
  },
  errors: {
    fallback: "Algo deu errado. Tente de novo.",
    invalidValue: "Valor inválido.",
    passwordLength: "Use de 12 a 128 caracteres.",
    codes: errorCodes,
    reasons: violationReasons,
  },
  format: {
    deviceOn: (browser, system) => `${browser} no ${system}`,
    unknownDevice: "Dispositivo desconhecido",
  },
  permissions,
  permissionLabel: (code: string) =>
    (permissions as Record<string, string | undefined>)[code] ?? code,
  roles,
  oauth: {
    notConfigured: (provider) => `Login com ${provider} não configurado`,
    configureHint: (envName) =>
      `Defina ${envName} em web/.env e reinicie o Vite.`,
    continueWith: "ou continue com",
  },
  signIn: {
    title: "Entrar na sua conta",
    subtitle:
      "Acesse suas sessões, convites e permissões de qualquer lugar, com tudo organizado em um só lugar.",
    forgotPassword: "Esqueceu a senha?",
    noAccount: "Ainda não tem conta?",
    accountDeactivated:
      "Esta conta está desativada. Peça a um administrador para reativá-la.",
    accountUnavailable:
      "Não foi possível entrar nesta conta. Fale com um administrador.",
  },
  signUp: {
    title: "Criar uma conta",
    subtitle:
      "Comece em segundos. Enviamos um link para confirmar seu e-mail logo depois do cadastro.",
    eyebrow: "Leva menos de um minuto",
    tagline: "Uma conta para acessar tudo, com sessões sob seu controle",
    emailTaken:
      "Esse e-mail já tem conta. Entre com GitHub ou Google, ou crie uma senha em “Esqueceu a senha?” na tela de login.",
    created: "Conta criada",
    confirmationSent: (email) =>
      `Enviamos um link de confirmação para ${email}.`,
    passwordHint: (min, max) =>
      `De ${min} a ${max} caracteres. Uma frase longa funciona bem.`,
    submit: "Começar",
    haveAccount: "Já tem uma conta?",
  },
  forgotPassword: {
    title: "Esqueceu a senha?",
    subtitle:
      "Digite o e-mail da sua conta e enviamos um link para criar uma senha nova. Vale também para contas criadas com GitHub ou Google.",
    eyebrow: "Acontece com todo mundo",
    tagline: "Recupere o acesso sem perder nada do que é seu",
    checkInbox: "Confira sua caixa de entrada",
    backToSignIn: "Voltar para o login",
    sent: (email) =>
      `Se houver uma conta com ${email}, o link chega em instantes. Ele vale por pouco tempo e só pode ser usado uma vez.`,
    submit: "Enviar link",
    remembered: "Lembrou?",
  },
  resetPassword: {
    title: "Criar uma senha nova",
    subtitle:
      "Depois de trocar, todas as sessões abertas são encerradas por segurança.",
    eyebrow: "Quase lá",
    tagline: "Uma senha nova e todas as sessões antigas encerradas",
    requestNewLink: "Pedir um link novo",
    saved: "Senha salva",
    savedDescription:
      "Use a senha nova para entrar com o seu e-mail. As sessões abertas foram encerradas.",
    mismatch: "As senhas não conferem.",
    savedNotice: "Senha salva. Entre com a senha nova.",
    repeatPassword: "Repita a senha nova",
    submit: "Redefinir senha",
  },
  verifyEmail: {
    newLinkSent: "Link novo enviado",
    missingToken: "O link veio sem o token. Abra-o como chegou no e-mail.",
    goToDashboard: "Ir para o painel",
    title: "Confirmação de e-mail",
    eyebrow: "Um passo a mais",
    tagline: "E-mail confirmado deixa sua conta mais fácil de recuperar",
    confirming: "Confirmando seu e-mail…",
    confirmed: "E-mail confirmado",
    confirmedDescription: (email) =>
      `${email} está confirmado. Tudo certo por aqui.`,
    failed: "Não deu para confirmar",
    sendNewLink: "Enviar link novo",
  },
  acceptInvitation: {
    title: "Você foi convidado",
    subtitle:
      "Escolha seu nome e uma senha. A conta já nasce confirmada, com o papel e as permissões do convite.",
    eyebrow: "Bem-vindo ao time",
    tagline: "Seu acesso já vem pronto, do jeito que o time preparou",
    incomplete: "Convite incompleto",
    goToSignIn: "Ir para o login",
    signedInAs: (email) =>
      `Você está conectado como ${email}. Aceitar o convite cria outra conta e troca a sessão deste navegador.`,
    welcome: (name) => `Bem-vindo, ${name}!`,
    submit: "Aceitar convite",
  },
  confirmEmailChange: {
    changedNotice: (email) =>
      `E-mail trocado para ${email}. Entre de novo com o endereço novo.`,
    title: "Trocar o e-mail da conta",
    eyebrow: "Confirmação",
    tagline: "Seu e-mail novo passa a valer para entrar e para receber avisos",
    openLinkAsReceived: "Abra o link exatamente como chegou no e-mail novo.",
    changed: "E-mail trocado",
    signInWithNewEmail: "Entrar com o e-mail novo",
    changedDescription: (email) =>
      `A conta agora usa ${email}. Todas as sessões foram encerradas e o endereço antigo recebeu um aviso.`,
    confirmTitle: "Confirmar a troca?",
    confirm: "Confirmar troca de e-mail",
    confirmDescription:
      "Ao confirmar, todas as sessões da conta são encerradas, inclusive esta, e você entra de novo com o e-mail novo.",
  },
  oauthCallback: {
    linked: (provider) => `${provider} conectado à sua conta`,
    created: (provider) => `Conta criada com ${provider}`,
    welcomeBack: (name) => `Bem-vindo de volta, ${name}`,
    emailTaken: (provider) =>
      `Já existe uma conta com o e-mail do ${provider}. Entre com e-mail e senha (ou crie uma em “Esqueceu a senha?”) e conecte o ${provider} em Segurança.`,
    title: (provider) => `Entrando com ${provider}`,
    eyebrow: "Login social",
    tagline: "Sem senha nova para lembrar",
    failed: "Não deu para concluir",
    checking: (provider) => `Conferindo a resposta do ${provider}…`,
  },
  notFound: {
    title: "Página não encontrada",
    tagline: "Esse caminho não leva a lugar nenhum",
    nothingHere: "Nada por aqui",
    backHome: "Voltar ao início",
    description: "Confira o endereço ou volte para o início.",
  },
  overview: {
    linkSent: "Link de confirmação enviado",
    checkEmail: (email) => `Confira ${email}.`,
    memberId: "ID do membro",
    createdAt: "Criada em",
    emailConfirmedAt: "E-mail confirmado em",
    notYet: "Ainda não",
    eyebrow: "Que bom te ver por aqui",
    greeting: (name) => `Olá, ${name}`,
    emailConfirmed: "E-mail confirmado",
    emailPending: "E-mail pendente",
    confirmEmail: "Confirme seu e-mail",
    resendLink: "Reenviar link",
    confirmEmailDescription: (email) =>
      `Enviamos um link para ${email} no cadastro. Ele ajuda a recuperar a conta se você esquecer a senha.`,
    activeSessions: "Sessões ativas",
    permissions: "Permissões",
    outOf: (total) => `de ${total}`,
    yourPermissions: "Suas permissões",
    yourPermissionsDescription:
      "O papel é só um rótulo; o que vale são as permissões abaixo.",
    accountDetails: "Detalhes da conta",
    accountDetailsDescription: "Copie o ID para usar no Explorador de rotas.",
  },
  profile: {
    title: "Perfil",
    description: "Seu nome, seu e-mail e sua senha.",
    personal: "Dados pessoais",
    personalDescription: "Como seu nome aparece para o time.",
    nameUpdated: "Nome atualizado",
    name: "Nome",
    emailDescription:
      "Enviamos um link de 1 hora para o endereço novo. A troca encerra todas as sessões.",
    confirmed: "Confirmado",
    notConfirmed: "Não confirmado",
    current: "Atual:",
    emailChangeSent: (email) =>
      `Abra o e-mail que mandamos para ${email} para concluir a troca.`,
    setPasswordFirst: "Defina uma senha primeiro",
    setPasswordFirstDescription:
      "A troca de e-mail pede a senha atual. Sua conta entra só com GitHub ou Google: crie uma senha pelo link do card abaixo.",
    newEmail: "E-mail novo",
    sendChangeLink: "Enviar link de troca",
    setPassword: "Definir senha",
    setPasswordDescription: (email) =>
      `Sua conta entra só com GitHub ou Google. Para criar uma senha, mandamos um link para ${email}: assim você mantém um jeito de entrar mesmo sem o provedor.`,
    changePasswordDescription:
      "Trocar a senha encerra todas as sessões, inclusive esta.",
    passwordLinkSent: (email) =>
      `Abra o e-mail que mandamos para ${email} e crie a senha por lá. Ao salvar, as sessões abertas são encerradas e você entra de novo.`,
    sendPasswordLink: "Enviar link para criar senha",
    passwordChanged:
      "Senha alterada. Por segurança, todas as sessões foram encerradas; entre de novo.",
    changePassword: "Trocar senha",
    deactivate: "Desativar conta",
    deactivateDescription:
      "A conta fica inativa e todas as sessões são encerradas. Só alguém com a permissão de reativar contas pode trazê-la de volta.",
    deactivateTitle: "Desativar sua conta?",
    deactivateConfirmDescription:
      "Você sai agora e não consegue entrar de novo até alguém reativar a conta.",
    deactivateConfirm: "Desativar",
  },
  sessions: {
    current: "Esta sessão",
    meta: (ip, opened, expires) =>
      `${ip} · aberta ${opened} · expira ${expires}`,
    end: "Encerrar",
    endTitle: "Encerrar esta sessão?",
    endDescription: (device, ip) =>
      `${device} (${ip}) vai precisar entrar de novo.`,
    ended: "Sessão encerrada",
    endedCount: (count) =>
      count === 1 ? "1 sessão encerrada" : `${count} sessões encerradas`,
    endAll: "Encerrar todas",
  },
  security: {
    title: "Segurança",
    description:
      "Onde sua conta está aberta e por quais provedores você entra.",
    connected: "Conectado",
    noEmail: "Sem e-mail",
    connectedAt: (relative) => `conectado ${relative}`,
    onlyMethod: "único jeito de entrar",
    useProvider: (provider) => `Use sua conta do ${provider} para entrar.`,
    disconnectTitle: (provider) => `Desconectar ${provider}?`,
    disconnectDescription: (provider) =>
      `Você deixa de entrar com o ${provider}. Dá para conectar de novo quando quiser.`,
    disconnect: "Desconectar",
    disconnected: (provider) => `${provider} desconectado`,
    connect: "Conectar",
    methods: "Formas de entrar",
    methodsDescription:
      "Entre com a senha, o GitHub ou o Google. Precisa sobrar pelo menos uma.",
    emailAndPassword: "E-mail e senha",
    active: "Ativo",
    noPassword: "Sem senha",
    passwordUpdated: (relative) => `senha atualizada ${relative}`,
    providersOnly: "Esta conta entra só pelos provedores abaixo.",
    changePassword: "Trocar senha",
    setPassword: "Definir senha",
    activeSessions: "Sessões ativas",
    activeSessionsDescription:
      "Cada login abre uma sessão nova; as outras continuam valendo até expirar ou serem encerradas.",
    reloadSessions: "Recarregar sessões",
    endOthersTitle: "Encerrar as outras sessões?",
    endOthersDescription: "Todo dispositivo além deste precisa entrar de novo.",
    endOthers: "Encerrar as outras",
    endAllTitle: "Encerrar todas as sessões?",
    endAllDescription:
      "Inclusive esta: você sai agora em todos os dispositivos.",
    allEndedNotice: (count) =>
      count === 1
        ? "1 sessão encerrada. Entre de novo."
        : `${count} sessões encerradas. Entre de novo.`,
  },
  invitations: {
    title: "Convites",
    description:
      "Convide pessoas por e-mail. O link vale 7 dias e um convite novo para o mesmo e-mail substitui o pendente.",
    noAccess: "Sem acesso aos convites",
    noAccessDescription: (create, read) =>
      `Peça a alguém do time as permissões “${create}” ou “${read}”.`,
    newInvitation: "Novo convite",
    newInvitationDescription:
      "Você só pode conceder permissões que já tem. O papel é só um rótulo.",
    sent: "Convite enviado",
    sentDescription: (email) => `${email} recebeu um link válido por 7 dias.`,
    emailPlaceholder: "pessoa@exemplo.com",
    role: "Papel",
    permissions: "Permissões",
    nothingToGrant: "Você não tem permissões para repassar.",
    send: "Enviar convite",
    pending: "Pendentes",
    pendingDescription: "Do mais novo para o mais antigo.",
    empty: "Nenhum convite pendente",
    emptyDescription:
      "Os convites enviados aparecem aqui até serem aceitos, revogados ou expirarem.",
    meta: (count, sent, expires) =>
      `${count === 1 ? "1 permissão" : `${count} permissões`} · enviado ${sent} · expira ${expires}`,
    revokeTitle: "Revogar este convite?",
    revokeDescription: (email) =>
      `O link enviado para ${email} deixa de funcionar.`,
    revoke: "Revogar",
    revoked: "Convite revogado",
  },
  members: {
    title: "Membros",
    description: "Quem está no time, com que papel e com quais permissões.",
    selfNotice:
      "Esta é a sua conta. Ninguém muda o próprio papel ou as próprias permissões.",
    role: "Papel",
    roleHint: "Só um rótulo; não dá nem tira acesso.",
    roleChanged: (role) => `Papel agora é ${role}`,
    chooseRole: "Escolha o papel",
    permissions: "Permissões",
    permissionsHintMember:
      "Marcadas são as que o membro tem hoje. Você só mexe nas que também tem.",
    permissionsHintManual:
      "Substitui o conjunto inteiro. Você só mexe nas que também tem.",
    permissionsUpdated: "Permissões atualizadas",
    permissionsCount: (count) =>
      count === 1 ? "1 permissão no membro." : `${count} permissões no membro.`,
    memberPermissions: "Permissões do membro",
    lockedPermission:
      "Você não tem essa permissão, então não pode dar nem tirar.",
    savePermissions: "Salvar permissões",
    access: "Acesso",
    accessHintUnknown: "Desativar encerra todas as sessões da conta.",
    accessHintDeactivated: "A conta está desativada e não consegue entrar.",
    accessHintActive:
      "A conta está ativa. Desativar encerra todas as sessões dela.",
    reactivateTitle: "Reativar a conta?",
    reactivateDescription: "A pessoa volta a conseguir entrar.",
    reactivateConfirm: "Reativar",
    reactivated: (name) => `${name} reativada`,
    reactivate: "Reativar conta",
    deactivateTitle: "Desativar a conta?",
    deactivateDescription:
      "A pessoa sai de todos os dispositivos e não entra até alguém reativar.",
    deactivateConfirm: "Desativar",
    deactivated: "Conta desativada",
    deactivate: "Desativar conta",
    sessions: "Sessões",
    revokeAllHint: "Força a pessoa a entrar de novo em todos os dispositivos.",
    revokeAllTitle: "Encerrar todas as sessões da conta?",
    revokeAllDescription: "Os refresh tokens dela deixam de valer na hora.",
    allSessionsEnded: "Todas as suas sessões foram encerradas.",
    revokeAll: "Encerrar todas as sessões",
    noSessions: "Nenhuma sessão ativa agora.",
    deactivatedBadge: "Desativada",
    you: "Você",
    lastSeen: "Último acesso",
    never: "Nunca",
    emailConfirmed: "E-mail confirmado",
    no: "Não",
    team: "Time",
    loaded: (count, more) =>
      `${count}${more ? "+" : ""} ${count === 1 && !more ? "membro carregado" : "membros carregados"}`,
    loadingList: "Carregando…",
    reload: "Recarregar membros",
    search: "Buscar por nome ou e-mail",
    nobodyFound: "Ninguém encontrado",
    loadMoreToSearch: "Carregue mais membros para buscar entre todos.",
    checkSearch: "Confira o nome ou o e-mail.",
    loadMore: "Carregar mais",
    chooseMember: "Escolha um membro",
    chooseMemberDescription:
      "O papel, as permissões e o acesso dele aparecem aqui.",
    listHidden: "Lista de membros oculta",
    listHiddenDescription: (permission) =>
      `Sem a permissão “${permission}”, informe o ID da conta de quem você quer gerenciar.`,
    member: "Membro",
    invalidAccountId: "Use os 24 caracteres hexadecimais do ID.",
    noAccess: "Sem acesso aos membros",
    noAccessDescription: (permission) =>
      `Peça a alguém do time a permissão “${permission}”.`,
  },
  explorer: {
    title: "Explorador de rotas",
    description: (count) =>
      `Chame qualquer uma das ${count} rotas da API e veja a resposta crua. Tokens devolvidos viram a sessão deste navegador.`,
    noResponse: "Sem resposta",
    myAccount: "Minha conta",
    currentSession: (device) => `${device} (esta)`,
    sessionReplaced: "Sessão deste navegador trocada pelos tokens da resposta",
    invalidJson: (message) => `JSON inválido: ${message}`,
    fillIn: (names) => `Preencha ${names}.`,
    sessionOf: "Sessão de",
    copyAccessToken: "Copiar access token",
    noSession: "Sem sessão",
    filter: "Filtrar por método, caminho ou texto",
    noMatch: "Nenhuma rota com esse filtro.",
    send: "Enviar",
    requiresSignIn: "Requer login",
    public: "Pública",
    body: "Corpo (JSON)",
    restoreExample: "Restaurar exemplo",
    noStoredToken: "não há token salvo",
    expected: "Previsto no contrato",
    unexpected: "Fora do contrato",
    copyResponse: "Copiar resposta",
    emptyBody: "Resposta sem corpo",
    noResponseYet: "Nenhuma resposta ainda",
    noResponseYetDescription: "Ajuste a requisição e clique em Enviar.",
    history: "Histórico",
    historyDescription: (limit) => `As últimas ${limit} chamadas desta aba.`,
    idPlaceholder: "24 caracteres hexadecimais",
    suggestionsHint: "Dê dois cliques no campo para ver sugestões.",
    groups: routeGroups,
    routes,
    queryHints,
    rateLimit: (limit: RateLimit) =>
      `${limit.max} ${rateWindows[limit.window]} ${rateScopes[limit.scope]}`,
  },
};
