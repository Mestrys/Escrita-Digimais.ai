/** Abre o painel lateral a partir do popup (gesto do usuário). */
export async function openSidePanel(): Promise<boolean> {
  try {
    const win = await chrome.windows.getCurrent();
    if (win.id === undefined) return false;
    await chrome.sidePanel.open({ windowId: win.id });
    return true;
  } catch {
    return false;
  }
}
