import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import sgMail from '@sendgrid/mail';

@Injectable()
export class PaymentsService {
  private stripe: InstanceType<typeof Stripe>;

  constructor(private prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-04-22.dahlia',
    });
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  }

  async createCheckoutSession(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, payment: true },
    });

    if (!order) throw new BadRequestException('Order not found');
    if (order.userId !== userId) throw new BadRequestException('Unauthorized');
    if (order.payment) throw new BadRequestException('Order already paid');

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: order.items.map((item) => ({
        price_data: {
          currency: 'eur',
          product_data: { name: item.product.name },
          unit_amount: Math.round(item.price * 100), // Stripe attend des centimes
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?orderId=${orderId}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: { orderId }, // récupéré dans le webhook pour faire le lien avec la commande
    });

    return { url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    let event: any;

    // On vérifie la signature avec le raw body — c'est pour ça que rawBody: true est activé dans main.ts
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      // TODO: récupérer event.data.object.metadata.orderId, marquer la commande comme payée et envoyer l'email de confirmation
    }

    return { received: true };
  }

  private async sendConfirmationEmail(order: any) {
    const itemsList = order.items
      .map((i: any) => `${i.product.name} x${i.quantity} — ${i.price}€`)
      .join('\n');

    await sgMail.send({
      to: order.user.email,
      from: process.env.SENDGRID_FROM_EMAIL!,
      subject: `Order confirmed #${order.id.slice(0, 8)}`,
      text: `Your order has been confirmed!\n\nItems:\n${itemsList}\n\nTotal: ${order.total}€`,
    });
  }
}