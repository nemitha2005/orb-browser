export interface OrbInteractionApi {
  createTab: (url?: string) => Promise<void>;
  closeTab: (tabId: number) => Promise<void>;
  navigateActiveTab: (input: string) => Promise<void>;
}

export function requestTabCreate(orb: OrbInteractionApi): void {
  void orb.createTab();
}

export function requestTabClose(orb: OrbInteractionApi, tabId: number): boolean {
  if (!Number.isInteger(tabId) || tabId <= 0) {
    return false;
  }

  void orb.closeTab(tabId);
  return true;
}

export function requestTabCloseIfActive(
  orb: OrbInteractionApi,
  activeTabId: number | null,
): boolean {
  if (activeTabId === null) {
    return false;
  }

  return requestTabClose(orb, activeTabId);
}

export function requestNavigateActiveTab(
  orb: OrbInteractionApi,
  rawInput: string,
): string | null {
  const normalizedInput = rawInput.trim();
  if (!normalizedInput) {
    return null;
  }

  void orb.navigateActiveTab(normalizedInput);
  return normalizedInput;
}