import {
  Controller, Post, Param, UseGuards,
  Request, Headers, Req
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post('checkout/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe checkout session for an order' })
  createCheckout(
    @Param('orderId') orderId: string,
    @Request() req: any,
  ) {
    return this.payments.createCheckoutSession(orderId, req.user.id);
  }

    @Post('webhook')
    @ApiOperation({ summary: 'Stripe webhook handler' })
    handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
    ) {
    return this.payments.handleWebhook(req.rawBody, signature);
    }
}