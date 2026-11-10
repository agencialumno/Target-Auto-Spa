export { servicos, getServico } from "./catalogo.svelte";
export { BUFFER_MIN, servicosBase } from "./catalogo-base";
export type { Categoria, Servico } from "./catalogo-base";
import type { Categoria } from "./catalogo-base";


export const nomesCategorias: Record<Categoria, string> = {
  lavagem: "Lavagem",
  estetica: "Estética e polimento",
  protecao: "Proteção e vitrificação",
  higienizacao: "Higienização",
  insulfilm: "Insulfilm",
};

// Sugestões do modal de upsell / order bump
export const upsellPor: Record<string, string[]> = {
  eco01: ["eco02", "eco04"],
  eco02: ["eco04", "eco06"],
  eco03: ["eco06", "eco19"],
  eco04: ["eco06"],
  eco06: ["eco10", "eco08"],
  eco07: ["eco10"],
  eco10: ["eco11"],
  eco09: ["eco12"],
  eco19: ["eco20", "eco21"],
  "combo-4-banhos": ["eco06", "eco19"],
};

export const angulos360 = [
  "Frente",
  "Traseira",
  "Lateral esquerda",
  "Lateral direita",
  "Painel",
  "Bancos",
  "Porta-malas",
  "Rodas",
];

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---- RESIDENCIAL (Home Spa) — sem preço/duração definidos ainda ----
export type ServicoResidencial = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  icone: string;
  beneficios: string[];
};

export const servicosResidenciais: ServicoResidencial[] = [
  {
    id: "eco34",
    codigo: "ECO34",
    nome: "Renovação de Estofados",
    descricao: "Limpeza premium que devolve o aspecto de novo aos estofados.",
    icone: "sparkle",
    beneficios: [
      "Remove sujeira e manchas profundas",
      "Devolve textura e cor originais",
      "Ambiente mais bonito e agradável",
    ],
  },
  {
    id: "eco35",
    codigo: "ECO35",
    nome: "Higienização Profunda de Estofados",
    descricao: "Remoção de fungos e bactérias dos estofados.",
    icone: "leaf",
    beneficios: [
      "Remove fungos, ácaros e bactérias",
      "Reduz odores e alergias",
      "Ambiente mais saudável para a família",
    ],
  },
  {
    id: "eco36",
    codigo: "ECO36",
    nome: "Impermeabilização de Estofados",
    descricao: "Proteção contra líquidos e manchas.",
    icone: "shield",
    beneficios: [
      "Protege contra líquidos derramados",
      "Facilita a limpeza no dia a dia",
      "Prolonga a vida útil dos estofados",
    ],
  },
  {
    id: "eco37",
    codigo: "ECO37",
    nome: "Tratamento Premium",
    descricao:
      "Renovação + higienização + impermeabilização, tudo em um pacote.",
    icone: "star",
    beneficios: [
      "Combina renovação, higienização e impermeabilização",
      "Melhor custo-benefício para uma limpeza completa",
      "Resultado e proteção em um só atendimento",
    ],
  },
  {
    id: "eco38",
    codigo: "ECO38",
    nome: "Insulfilm Poliéster Residencial",
    descricao: "Instalação de insulfilm poliéster em janelas e vidros.",
    icone: "layers",
    beneficios: [
      "Reduz a entrada de calor e claridade",
      "Mais privacidade para os ambientes",
      "Instalação por profissional especializado",
    ],
  },
  {
    id: "eco39",
    codigo: "ECO39",
    nome: "Insulfilm Nano Cerâmica Premium",
    descricao: "Retenção de 99% dos raios UVA e UVB.",
    icone: "layers",
    beneficios: [
      "Retém 99% dos raios UVA e UVB",
      "Maior conforto térmico no ambiente",
      "Protege móveis e cortinas do desbotamento",
    ],
  },
];
