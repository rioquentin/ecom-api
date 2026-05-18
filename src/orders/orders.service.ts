import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrderDto) {
    // On vérifie le stock de chaque article et on calcule le total avant de toucher la base
    let total = 0;
    const enrichedItems: { product: any; quantity: number; price: number }[] = [];

    for (const item of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) throw new NotFoundException(`Product ${item.productId} not found`);
      if (product.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`);
      }

      total += product.price * item.quantity;
      enrichedItems.push({ product, quantity: item.quantity, price: product.price });
    }

    // Création de la commande et décrémentation du stock dans la même transaction
    // pour éviter qu'une erreur en cours de route laisse le stock incohérent
    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          total,
          items: {
            create: enrichedItems.map((i) => ({
              productId: i.product.id,
              quantity: i.quantity,
              price: i.price,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      for (const i of enrichedItems) {
        await tx.product.update({
          where: { id: i.product.id },
          data: { stock: { decrement: i.quantity } },
        });
      }

      return newOrder;
    });

    return order;
  }

  async findAll(userId: string, role: string) {
    // Un admin voit toutes les commandes, un client ne voit que les siennes
    return this.prisma.order.findMany({
      where: role === 'ADMIN' ? undefined : { userId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, payment: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    // On renvoie 404 plutôt que 403 pour ne pas révéler qu'une commande existe
    if (role !== 'ADMIN' && order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.order.update({
      where: { id },
      data: { status: status as any },
    });
  }
}