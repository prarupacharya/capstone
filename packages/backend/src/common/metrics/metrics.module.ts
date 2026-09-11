import { Module } from "@nestjs/common";
import { HttpMetricsService } from "./http-metrics.service";
import { MetricsController } from "./metrics.controller";

@Module({
  controllers: [MetricsController],
  providers: [HttpMetricsService],
  exports: [HttpMetricsService]
})
export class MetricsModule {}
