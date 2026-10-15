// Service worker mínimo: sem estado em memória, sem rede, sem acesso a abas.
// Garante que o ícone abra o popup (que por sua vez abre o painel lateral).
chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
});
