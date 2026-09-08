import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/auth/public.decorator";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  getHealth() {
    return this.healthService.getStatus();
  }
}
