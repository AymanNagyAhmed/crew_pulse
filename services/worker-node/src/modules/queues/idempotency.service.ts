import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

/**
 * Redis SET NX keys so duplicate BullMQ deliveries do not double-apply work.
 * Key form: worker:idempotency:<namespace>:<key>
 */
@Injectable()
export class IdempotencyService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>('REDIS_URL');
    this.redis = new Redis(url, { maxRetriesPerRequest: null });
  }

  async ping(): Promise<string> {
    return this.redis.ping();
  }

  async tryClaim(
    namespace: string,
    key: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const redisKey = `worker:idempotency:${namespace}:${key}`;
    const result = await this.redis.set(
      redisKey,
      '1',
      'EX',
      Math.max(1, ttlSeconds),
      'NX',
    );
    return result === 'OK';
  }

  /** Release a claim so BullMQ can retry after a transient vision failure (C9). */
  async release(namespace: string, key: string): Promise<void> {
    const redisKey = `worker:idempotency:${namespace}:${key}`;
    await this.redis.del(redisKey);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
