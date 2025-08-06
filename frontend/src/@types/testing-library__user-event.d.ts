declare module '@testing-library/user-event' {
  interface SetupOptions {
    advanceTimers?: ((ms: number) => void | Promise<void>) | typeof jest.advanceTimersByTime;
    applyAccept?: boolean;
    autoModify?: boolean;
    delay?: number;
    document?: Document;
    keyboardMap?: Array<{
      code?: string;
      key?: string;
      keyCode?: number;
      which?: number;
    }>;
    pointerEventsCheck?: 0 | 1 | 2;
    pointerMap?: Array<{
      name: string;
      pointerType?: 'mouse' | 'pen' | 'touch';
    }>;
    skipAutoClose?: boolean;
    skipClick?: boolean;
    skipHover?: boolean;
    skipPointerEventsCheck?: boolean;
    writeToClipboard?: boolean;
  }

  interface UserEvent {
    click(element: Element): Promise<void>;
    dblClick(element: Element): Promise<void>;
    tripleClick(element: Element): Promise<void>;
    hover(element: Element): Promise<void>;
    unhover(element: Element): Promise<void>;
    tab(options?: { shift?: boolean }): Promise<void>;
    keyboard(text: string): Promise<void>;
    copy(): Promise<void>;
    cut(): Promise<void>;
    paste(clipboardData?: DataTransfer | string): Promise<void>;
    pointer(
      actions: Array<
        | { keys: string }
        | { target: Element }
        | { coords: { x: number; y: number } }
        | { offset: { x: number; y: number } }
      >
    ): Promise<void>;
    clear(element: Element): Promise<void>;
    selectOptions(
      element: Element,
      values: string | string[] | HTMLElement | HTMLElement[]
    ): Promise<void>;
    deselectOptions(
      element: Element,
      values: string | string[] | HTMLElement | HTMLElement[]
    ): Promise<void>;
    upload(element: HTMLInputElement, files: File | File[]): Promise<void>;
    type(
      element: Element,
      text: string,
      options?: {
        skipClick?: boolean;
        skipAutoClose?: boolean;
        initialSelectionStart?: number;
        initialSelectionEnd?: number;
      }
    ): Promise<void>;
  }

  function setup(options?: SetupOptions): UserEvent;

  const userEvent: {
    setup: typeof setup;
  };

  export default userEvent;
}