/**
 * thermal-printer.ts — Re-exports para manter compatibilidade.
 * A implementação real está nos módulos separados:
 * - printer-connection.ts (init, status, pool)
 * - printer-comprovante.ts
 * - printer-pix.ts
 * - printer-pedido.ts
 * - printer-test.ts
 * - print-queue.ts
 */

export { initPrinter, getPrinterStatus, closePrinter } from './printer-connection';
export { printComprovante } from './printer-comprovante';
export { printPixQrCode } from './printer-pix';
export { printPedido } from './printer-pedido';
export { printTestPage } from './printer-test';
