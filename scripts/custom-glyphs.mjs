// Glifos de interface desenhados à mão no mesmo estilo do Phosphor (viewBox 256, preenchidos, recortes com evenodd)
// para o que o Phosphor não tem. Entram em src/ui/glyphs.ts junto com os do Phosphor (scripts/glyphs.mjs).
export const CUSTOM = {
  // chapéu do Kage (kasa cônico): copa com o painel em losango na frente, aba larga e as fitas de amarrar
  kage: `<path fill-rule="evenodd" d="M128 46c6 0 11 3 15 7l96 90c5 5 3 13-4 14-34 8-70 12-107 12s-73-4-107-12c-7-1-9-9-4-14l96-90c4-4 9-7 15-7Zm0 36-22 32 22 32 22-32Zm0 18-10 14 10 14 10-14Z"/><path d="M100 176h14l20 46-12 6Zm56 0h-14l-20 46 12 6Z"/>`,
  // cabeça de ninja de frente: capuz e máscara, bandana com a placa e a fresta dos olhos
  shinobi: `<path fill-rule="evenodd" d="M128 22c56 0 94 40 94 94 0 62-42 116-94 116S34 178 34 116c0-54 38-94 94-94ZM44 84c-4 8-6 16-7 24h182c-1-8-3-16-7-24Zm62 4h44a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6h-44a6 6 0 0 1-6-6v-8a6 6 0 0 1 6-6Zm14 8v4h20v-4Zm-72 28c-6 0-10 4-10 10v8c0 14 12 24 26 24h112c14 0 26-10 26-24v-8c0-6-4-10-10-10Z"/><path d="M76 138c10-6 24-6 34 2-10 8-24 8-34-2Zm104 0c-10-6-24-6-34 2 10 8 24 8 34-2Z"/><path d="M216 92l34-16-4 18-28 10Zm2 16 30 4-8 14-24-8Z"/>`,
  // lápide (perdas): pedra de topo redondo com a cruz e o monte de terra
  grave: `<path fill-rule="evenodd" d="M72 198V98c0-34 24-60 56-60s56 26 56 60v100Zm48-128v28H96v16h24v48h16v-48h24V98h-24V70Z"/><rect x="36" y="206" width="184" height="28" rx="14"/>`,
};
