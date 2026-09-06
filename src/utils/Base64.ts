/**
 * Размер порции при сборке двоичной строки.
 * Аргументы String.fromCharCode кладутся на стек, поэтому передавать весь массив разом нельзя.
 */
const CHUNK_SIZE = 0x8000;

/**
 * Закодировать текст в base64.
 *
 * btoa работает с байтами, а не с символами, и на кириллице падает —
 * поэтому текст сначала переводится в UTF-8.
 *
 * @param text исходный текст.
 * @returns строка в кодировке base64.
 */
export function encodeUtf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE));
  }
  return btoa(binary);
}

/**
 * Раскодировать текст из base64.
 *
 * @param base64 строка в кодировке base64, возможно с переносами строк.
 * @returns исходный текст.
 */
export function decodeBase64ToUtf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
