export type ColaboradorReferencia = {
  nome: string;
  email: string;
  perfil: "admin" | "membro" | "cliente";
  status: "cadastrado" | "aguardando_primeiro_acesso";
  observacao?: string;
};

/** Fonte: Informações Colaboradores.docx.pdf (jul/2026) */
export const COLABORADORES_REFERENCIA: ColaboradorReferencia[] = [
  {
    nome: "Mariana",
    email: "mariana@iaplicada.com",
    perfil: "admin",
    status: "cadastrado",
    observacao: "Administradora IAplicada",
  },
  {
    nome: "Charlene Brito de Oliveira",
    email: "cbmoveneuro@gmail.com",
    perfil: "admin",
    status: "aguardando_primeiro_acesso",
    observacao: "Gestora CB Move",
  },
  {
    nome: "Diego Silveira de Paula Xavier",
    email: "diegoxavier.fisio@gmail.com",
    perfil: "admin",
    status: "aguardando_primeiro_acesso",
    observacao: "Administrador",
  },
  {
    nome: "Adriano de Lima Cezar",
    email: "adrianolimacezar@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Brenda Lacerda Farias",
    email: "lacerdabrenda21@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Camila Aguiar Pereira",
    email: "fisiocamilap@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Carlos Eduardo Moraes Oliveira",
    email: "moraes.cadu98@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Daniele Martins Moraes",
    email: "danielemoraes2@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Fernanda Eduarda Pereira Ferreira",
    email: "fernandapereira.fisioterapia@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Gabriel Arrosi Fracaso",
    email: "gabrielarrosi@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Gabriel Romagna da Costa",
    email: "gabrielcoxta@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Gelson Leonardo dos Santos Klagenberg",
    email: "leoklagenberg@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Henrique Mollmann Pedrotti",
    email: "hiquepedrotti@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Kelen Silveira da Rosa",
    email: "kelensilveira4@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Leonardo Pires Batista",
    email: "leonardopb15@hotmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Lorenzo Caon Da Silva",
    email: "lorenzocaon@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Lucas da Silva Santos",
    email: "fisiolucas.dsantos@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Mathias Mariani de Campos Velho Teixeira",
    email: "mathiasteixeira5@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Ohana Figueiredo Medeiros",
    email: "fisioterapiaohana@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Raisa Machado Alves",
    email: "raisa04@hotmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Rebeca Andrade de Mello",
    email: "rebecamello.a@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Rinaldo Pietrowski Pinto",
    email: "rinaldopietrowski@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Taiane dos Santos Soares",
    email: "taiane.soaress@hotmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Thales Escalante",
    email: "thales.escalante@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
  {
    nome: "Vitória Vicenza Pedroso da Silva",
    email: "vicenzavitoria@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
    observacao: "Secretaria — acesso operacional (não fisio)",
  },
  {
    nome: "William Vinícius Monteiro Pacheco",
    email: "williammonteiro1988@gmail.com",
    perfil: "membro",
    status: "aguardando_primeiro_acesso",
  },
];

export const COLABORADORES_POR_EMAIL = Object.fromEntries(
  COLABORADORES_REFERENCIA.map((c) => [c.email.toLowerCase(), c]),
);
