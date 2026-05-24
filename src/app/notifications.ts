export interface Notifier {
  info(message: string): void;
  error(message: string): void;
  confirm(message: string): boolean;
}

export class BrowserNotifier implements Notifier {
  info(message: string): void {
    window.alert(message);
  }

  error(message: string): void {
    window.alert(message);
  }

  confirm(message: string): boolean {
    return window.confirm(message);
  }
}
