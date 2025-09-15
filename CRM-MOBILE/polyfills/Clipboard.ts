// Web-compatible Clipboard polyfill
const Clipboard = {
  async setStringAsync(text: string): Promise<void> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.warn('Clipboard setStringAsync error:', error);
      throw error;
    }
  },
  
  async getStringAsync(): Promise<string> {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText();
      } else {
        throw new Error('Clipboard read not supported');
      }
    } catch (error) {
      console.warn('Clipboard getStringAsync error:', error);
      throw error;
    }
  }
};

export { Clipboard };
export const { setStringAsync, getStringAsync } = Clipboard;
export default Clipboard;
