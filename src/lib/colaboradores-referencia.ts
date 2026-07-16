export type ColaboradorReferencia = {
  nome: string;
  email: string;
  perfil: "admin" | "membro" | "cliente";
  status: "cadastrado" | "pendente_convite";
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
    status: "pendente_convite",
    observacao: "Gestora CB Move",
  },
  {
    nome: "Diego Silveira de Paula Xavier",
    email: "diegoxavier.fisio@gmail.com",
    perfil: "admin",
    status: "pendente_convite",
    observacao: "Administrador",
  },
  {
    nome: "Adriano de Lima Cezar",
    email: "adrianolimacezar@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Brenda Lacerda Farias",
    email: "lacerdabrenda21@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Camila Aguiar Pereira",
    email: "fisiocamilap@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Carlos Eduardo Moraes Oliveira",
    email: "moraes.cadu98@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Daniele Martins Moraes",
    email: "danielemoraes2@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Fernanda Eduarda Pereira Ferreira",
    email: "fernandapereira.fisioterapia@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Gabriel Arrosi Fracaso",
    email: "gabrielarrosi@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Gabriel Romagna da Costa",
    email: "gabrielcoxta@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Gelson Leonardo dos Santos Klagenberg",
    email: "leoklagenberg@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Henrique Mollmann Pedrotti",
    email: "hiquepedrotti@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Kelen Silveira da Rosa",
    email: "kelensilveira4@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Leonardo Pires Batista",
    email: "leonardopb15@hotmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Lorenzo Caon Da Silva",
    email: "lorenzocaon@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Lucas da Silva Santos",
    email: "fisiolucas.dsantos@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Mathias Mariani de Campos Velho Teixeira",
    email: "mathiasteixeira5@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Ohana Figueiredo Medeiros",
    email: "fisioterapiaohana@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Raisa Machado Alves",
    email: "raisa04@hotmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Rebeca Andrade de Mello",
    email: "rebecamello.a@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Rinaldo Pietrowski Pinto",
    email: "rinaldopietrowski@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Taiane dos Santos Soares",
    email: "taiane.soaress@hotmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Thales Escalante",
    email: "thales.escalante@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "Vitória Vicenza Pedroso da Silva",
    email: "vicenzavitoria@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
  {
    nome: "William Vinícius Monteiro Pacheco",
    email: "williammonteiro1988@gmail.com",
    perfil: "membro",
    status: "pendente_convite",
  },
];

export const COLABORADORES_POR_EMAIL = Object.fromEntries(
  COLABORADORES_REFERENCIA.map((c) => [c.email.toLowerCase(), c]),
);
