import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  ATTENDANCE_CHECK_IN_QUEUE,
  ATTENDANCE_LOG_QUEUE,
  WEBHOOK_QUEUE,
} from './queue.constants.js';

export type QueueDepthSnapshot = {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  /** waiting + delayed — primary backpressure signal before shift start */
  depth: number;
};

@Injectable()
export class QueueMetricsService {
  constructor(
    @InjectQueue(ATTENDANCE_CHECK_IN_QUEUE)
    private readonly checkInQueue: Queue,
    @InjectQueue(ATTENDANCE_LOG_QUEUE)
    private readonly attendanceLogQueue: Queue,
    @InjectQueue(WEBHOOK_QUEUE)
    private readonly webhookQueue: Queue,
  ) {}

  async snapshot(): Promise<QueueDepthSnapshot[]> {
    return Promise.all([
      this.depthFor(ATTENDANCE_CHECK_IN_QUEUE, this.checkInQueue),
      this.depthFor(ATTENDANCE_LOG_QUEUE, this.attendanceLogQueue),
      this.depthFor(WEBHOOK_QUEUE, this.webhookQueue),
    ]);
  }

  async checkInDepth(): Promise<QueueDepthSnapshot> {
    return this.depthFor(ATTENDANCE_CHECK_IN_QUEUE, this.checkInQueue);
  }

  private async depthFor(
    name: string,
    queue: Queue,
  ): Promise<QueueDepthSnapshot> {
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
      'completed',
    );
    const waiting = counts.waiting ?? 0;
    const delayed = counts.delayed ?? 0;
    return {
      name,
      waiting,
      active: counts.active ?? 0,
      delayed,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
      depth: waiting + delayed,
    };
  }
}
