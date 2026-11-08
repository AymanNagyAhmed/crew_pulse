import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration.js';
import { validateEnv } from './config/env.validation.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { DatabaseModule } from './modules/database/database.module.js';
import { GalleryModule } from './modules/gallery/gallery.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ShiftsModule } from './modules/shifts/shifts.module.js';
import { VenuesModule } from './modules/venues/venues.module.js';
import { WorkersModule } from './modules/workers/workers.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    DatabaseModule,
    HealthModule,
    WorkersModule,
    VenuesModule,
    ShiftsModule,
    AttendanceModule,
    GalleryModule,
  ],
})
export class AppModule {}
