import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { BarberServiceLayer } from './barber.service.js';

@Controller('barber-customer')
export class BarberCustomerController {
  constructor(private readonly barber: BarberServiceLayer) {}

  @Get('me')
  getOwnProfile(@Req() request: AuthenticatedRequest) {
    return this.barber.getOwnCustomer(request.authUser!.id);
  }
}
