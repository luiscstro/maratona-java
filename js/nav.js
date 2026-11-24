// Pilha de camadas (visualizador, álbum, pesquisa) ligada ao histórico do navegador,
// para o gesto de voltar do iOS fechar a camada de cima.
const stack = [];
let skip = 0;

export function pushLayer(name, onPop) {
  history.pushState({ layer: name }, '');
  stack.push({ name, onPop });
}

/** Fecha por código (botão/animação): remove a entrada do histórico sem chamar onPop. */
export function closeLayer(name) {
  const i = stack.map((s) => s.name).lastIndexOf(name);
  if (i < 0) return;
  stack.splice(i, 1);
  skip++;
  history.back();
}

export const topLayer = () => (stack.length ? stack[stack.length - 1].name : null);

window.addEventListener('popstate', () => {
  if (skip > 0) { skip--; return; }
  const top = stack.pop();
  if (top) top.onPop();
});
