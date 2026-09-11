import { Controller, Get, Header } from "@nestjs/common";
import * as promClient from "prom-client";
import { Public } from "../auth/public.decorator";

@Controller()
export class MetricsController {
  @Get("metrics")
  @Public()
  @Header("Content-Type", promClient.register.contentType)
  async getMetrics() {
    return await promClient.register.metrics();
  }
}
