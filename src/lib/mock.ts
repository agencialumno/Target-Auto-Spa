export const BUFFER_MIN = 15;

export type Categoria = 'lavagem' | 'estetica' | 'avulso';

export type Servico = {
  id: string;
  nome: string;
  descricao: string;
  categoria: Categoria;
  duracao: number; // minutos de execução
  preco: number; // valores de exemplo, ajuste aqui
  avulso: boolean; // true = agenda separada, profissional externo
  oculto?: boolean; // só aparece como sugestão (upsell)
  semDesconto?: boolean; // combos não recebem desconto extra
  garantia?: string;
  inclui: string[];
  icone: string;
  video: string | null; // coloque a URL do vídeo quando gravarem
};

export const servicos: Servico[] = [
  {
    id: 'lavagem-secagem',
    nome: 'Lavagem + secagem',
    descricao: 'Lavagem externa completa com secagem manual.',
    categoria: 'lavagem',
    duracao: 30,
    preco: 45,
    avulso: false,
    inclui: [
      'Lavagem externa completa',
      'Secagem manual com microfibra',
      'Produtos biodegradáveis, sem soda cáustica'
    ],
    icone: 'drop',
    video: null
  },
  {
    id: 'lavagem-secagem-aspiracao',
    nome: 'Lavagem + secagem + aspiração',
    descricao: 'Lavagem completa por fora e aspiração por dentro.',
    categoria: 'lavagem',
    duracao: 60,
    preco: 90,
    avulso: false,
    inclui: [
      'Lavagem externa completa',
      'Secagem manual com microfibra',
      'Aspiração interna (bancos, tapetes e porta-malas)',
      'Produtos biodegradáveis, sem soda cáustica'
    ],
    icone: 'sparkle',
    video: null
  },
  {
    id: 'combo-4-lavagens',
    nome: 'Combo 4 lavagens completas',
    descricao: '4 × lavagem + secagem + aspiração com 10% de desconto.',
    categoria: 'lavagem',
    duracao: 60,
    preco: 324, // 4 × 90 com 10% de desconto
    avulso: false,
    semDesconto: true,
    inclui: [
      '4 lavagens + secagem + aspiração',
      '10% de desconto sobre o valor avulso',
      'Você agenda a primeira agora e as outras quando quiser'
    ],
    icone: 'star',
    video: null
  },
  {
    id: 'aspiracao',
    nome: 'Aspiração interna',
    descricao: 'Bancos, tapetes e porta-malas.',
    categoria: 'lavagem',
    duracao: 30,
    preco: 45,
    avulso: false,
    oculto: true,
    inclui: ['Aspiração de bancos, tapetes e porta-malas'],
    icone: 'car',
    video: null
  },
  {
    id: 'polimento',
    nome: 'Polimento',
    descricao: 'Recupera o brilho e remove micro riscos da pintura.',
    categoria: 'estetica',
    duracao: 120,
    preco: 250,
    avulso: false,
    inclui: [
      'Correção leve da pintura',
      'Brilho profundo',
      'Produtos biodegradáveis'
    ],
    icone: 'sparkle',
    video: null
  },
  {
    id: 'vitrificacao',
    nome: 'Vitrificação',
    descricao: 'Proteção de longa duração para a pintura.',
    categoria: 'estetica',
    duracao: 180,
    preco: 900,
    avulso: false,
    garantia: '2 anos, atua só na pintura',
    inclui: [
      'Camada protetora cerâmica na pintura',
      'Mais brilho e facilidade de limpeza',
      'Garantia de 2 anos'
    ],
    icone: 'shield',
    video: null
  },
  {
    id: 'ionizacao',
    nome: 'Ionização',
    descricao: 'Proteção para todas as superfícies do veículo.',
    categoria: 'estetica',
    duracao: 90,
    preco: 600,
    avulso: false,
    garantia: '4 anos, atua em todas as superfícies',
    inclui: [
      'Proteção em todas as superfícies',
      'Ação de longa duração',
      'Garantia de 4 anos'
    ],
    icone: 'shield',
    video: null
  },
  {
    id: 'insulfilm',
    nome: 'Insulfilm',
    descricao: 'Instalação por profissional especializado.',
    categoria: 'avulso',
    duracao: 120,
    preco: 350,
    avulso: true,
    inclui: [
      'Instalação por profissional externo',
      'Agenda separada dos demais serviços',
      'Agendamento com no mínimo 36 horas de antecedência'
    ],
    icone: 'layers',
    video: null
  }
];

export const getServico = (id: string) => servicos.find((s) => s.id === id);

// Sugestões do modal de upsell / order bump, por serviço escolhido
export const upsellPor: Record<string, string[]> = {
  'lavagem-secagem': ['aspiracao', 'polimento'],
  'lavagem-secagem-aspiracao': ['polimento', 'vitrificacao'],
  'combo-4-lavagens': ['polimento', 'vitrificacao'],
  polimento: ['vitrificacao', 'aspiracao'],
  vitrificacao: ['ionizacao'],
  ionizacao: ['lavagem-secagem-aspiracao']
};

// Planos de assinatura (valores e descontos de exemplo)
export const planos = [
  {
    id: 'essencial',
    nome: 'Essencial',
    preco: 149,
    desconto: 10,
    inclui: ['2 lavagens + secagem por mês', '10% de desconto nos demais serviços']
  },
  {
    id: 'premium',
    nome: 'Premium',
    preco: 249,
    desconto: 15,
    inclui: [
      '4 lavagens + secagem por mês',
      '15% de desconto nos demais serviços',
      'Prioridade nos horários'
    ]
  }
];

// Ângulos do checklist 360º (antes e depois)
export const angulos360 = [
  'Frente',
  'Traseira',
  'Lateral esquerda',
  'Lateral direita',
  'Painel',
  'Bancos',
  'Porta-malas',
  'Rodas'
];

export const avaliacoes = [
  { nome: 'Cliente exemplo', nota: 5, texto: 'Carro impecável e sem sair do condomínio.' },
  { nome: 'Cliente exemplo', nota: 5, texto: 'Pontual e muito cuidadoso.' }
];

export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });