export const courses = [
  { code: 'BCS1540', short: 'AD', name: 'Algorithmic Design', chapters: 10, topics: 'Greedy methods · dynamic programming · complexity' },
  { code: 'BCS1520', short: 'Stats', name: 'Statistics', chapters: 13, topics: 'Probability · inference · data workflows' },
  { code: 'BCS2410', short: 'EP', name: 'Embedded Programming', chapters: 7, topics: 'C memory · ARM · FPGA and edge AI' },
  { code: 'BCS2420', short: 'CS', name: 'Computer Security', chapters: 7, topics: 'Cryptography · authentication · system defence' },
  { code: 'BCS2540', short: 'NM', name: 'Numerical Methods', chapters: 7, topics: 'Equations · interpolation · numerical integration' }
] as const

export const contacts = {
  info: 'info@study.wicker.life',
  support: 'support@study.wicker.life',
  privacy: 'privacy@study.wicker.life',
  security: 'security@study.wicker.life',
  legal: 'legal@study.wicker.life'
} as const

export type ContactKind = keyof typeof contacts

export const operatorName = 'David Henry Francis Wicker'
