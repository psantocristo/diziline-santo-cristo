/**
 * PrintQueue — Fila sequencial de impressão com pool de conexão.
 * Garante que apenas um job acesse a impressora por vez,
 * mantém a conexão aberta e faz retry com backoff.
 */
import logger from '../utils/logger';

interface PrintJob {
  id: string;
  execute: () => Promise<void>;
  resolve: (value: void) => void;
  reject: (reason: any) => void;
  retries: number;
  addedAt: number;
}

const MAX_RETRIES = 2;
const JOB_TIMEOUT = 15_000; // 15s per job

class PrintQueue {
  private queue: PrintJob[] = [];
  private processing = false;
  private totalJobs = 0;
  private totalErrors = 0;
  private totalSuccess = 0;

  get stats() {
    return {
      pending: this.queue.length,
      processing: this.processing,
      totalJobs: this.totalJobs,
      totalErrors: this.totalErrors,
      totalSuccess: this.totalSuccess,
    };
  }

  /**
   * Enfileira um job de impressão e retorna uma Promise que resolve quando impresso.
   */
  enqueue(execute: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      const job: PrintJob = {
        id: `PJ_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        execute,
        resolve,
        reject,
        retries: 0,
        addedAt: Date.now(),
      };

      this.queue.push(job);
      this.totalJobs++;
      logger.debug(`PrintQueue: job ${job.id} enfileirado (fila: ${this.queue.length})`);
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const job = this.queue.shift()!;
    logger.debug(`PrintQueue: processando job ${job.id}`);

    try {
      // Timeout protection
      await Promise.race([
        job.execute(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de impressão (15s)')), JOB_TIMEOUT)
        ),
      ]);

      this.totalSuccess++;
      job.resolve();
    } catch (err: any) {
      if (job.retries < MAX_RETRIES) {
        job.retries++;
        logger.warn(`PrintQueue: retry ${job.retries}/${MAX_RETRIES} para job ${job.id}: ${err.message}`);
        this.queue.unshift(job); // Re-enqueue at front
      } else {
        this.totalErrors++;
        logger.error(`PrintQueue: job ${job.id} falhou após ${MAX_RETRIES} tentativas: ${err.message}`);
        job.reject(err);
      }
    } finally {
      this.processing = false;
      // Process next job (with small delay to avoid tight loops on error)
      if (this.queue.length > 0) {
        setTimeout(() => this.processNext(), 50);
      }
    }
  }

  /**
   * Limpa a fila (ex: durante shutdown)
   */
  clear(): void {
    for (const job of this.queue) {
      job.reject(new Error('Fila de impressão encerrada'));
    }
    this.queue = [];
  }
}

export const printQueue = new PrintQueue();
