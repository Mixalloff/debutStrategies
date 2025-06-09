import { Debut } from "@debut/community-core";
import { EMA } from "@debut/indicators";
import { IndicatorsSchema, ReportPluginAPI } from "@debut/plugin-report";
import { sessionPlugin, SessionPluginOptions } from "@debut/plugin-session";
import { statsPlugin, StatsPluginAPI } from "@debut/plugin-stats";
import { VirtualTakesOptions, virtualTakesPlugin } from "@debut/plugin-virtual-takes";
import { BaseTransport, Candle, DebutOptions, OrderType } from "@debut/types";

export interface FollowEMAOptions extends DebutOptions, SessionPluginOptions, VirtualTakesOptions {
  fastPeriod: number;
  slowPeriod: number;
  openPercent: number;
}

/**
 * Стратегия, основанная на открытии позиции при пересечении быстрой ЕМА медленной
 * Плавающий стоп = FLOATING_STOP_PERCENT. Если акция идет в нужном направлении - пододвигаем стоп.
 */
export class FollowEMABot extends Debut {
  declare plugins: StatsPluginAPI & ReportPluginAPI;

  private ema: EMA;
  private slowEMA: EMA;
  private fastEmaResult: number[] = [];
  private slowEmaResult: number[] = [];
  // private allowOrders = true;
  FLOATING_STOP_PERCENT = .02;
  cHistory: number[] = []; // массив значений 

  constructor(transport: BaseTransport, public opts: FollowEMAOptions) {
    super(transport, opts);

    this.ema = new EMA(this.opts.fastPeriod);
    this.slowEMA = new EMA(this.opts.slowPeriod);

    this.registerPlugins([
      this.opts.from && this.opts.to && sessionPlugin(this.opts),
      virtualTakesPlugin(this.opts),
      statsPlugin(this.opts),
    ]);
  }

  public getIndicators(): IndicatorsSchema {
    return [
      {
        name: 'ft',
        figures: [
          {
            name: 'fast',
            getValue: () => {
              return this.fastEmaResult[0];
            },
          },
          {
            name: 'slow',
            getValue: () => {
              return this.slowEmaResult[0];
            },
          },
        ],
        inChart: true,
      },
    ];
  };

  async openMonitoring(c: number, fastEMA?: number[], slowEMA?: number[]) {
    const order = this.orders[0];

    if (!order) {
      if (
        this.cHistory[0] >= slowEMA[0] &&
        this.cHistory[1] < slowEMA[1]
      ) {
        const newOrder = await this.createOrder(OrderType.BUY);
      }

      if (
        this.cHistory[0] <= slowEMA[0] &&
        this.cHistory[1] > slowEMA[1]
      ) {
        const newOrder = await this.createOrder(OrderType.SELL);
      }
    } else {
      if (order.type === OrderType.SELL) {
        const currentStopLoss = slowEMA[0] * (1 + this.FLOATING_STOP_PERCENT);

        if (c >= currentStopLoss) {
          console.log(`Closed short: ${ (order.price - c) / order.price * 100 }%`, order.lots);
          await this.closeOrder(order);
          return;
        }
      } else {
        const currentStopLoss = slowEMA[0] * (1 - this.FLOATING_STOP_PERCENT);
        if (c <= currentStopLoss) {
          console.log(`Closed long: ${ (c - order.price) / order.price * 100 }%`, order.lots);
          await this.closeOrder(order);
          return;
        }
      }
    }
  }

  async onCandle({ c }: Candle) {
    try {
      // Проверяем статус активного ордера, только на закрытие свечи
      const fastEMA = this.getFastEMA(c);
      const slowEMA = this.getSlowEMA(c);

      this.cHistory.unshift(c);
      await this.openMonitoring(c, fastEMA, slowEMA);
    } catch (e) {
      console.log(this.getName(), e);
    }
  }

  private getFastEMA(value: number) {
      this.fastEmaResult.unshift(this.ema.nextValue(value));

      if (this.fastEmaResult.length === 3) {
          this.fastEmaResult.splice(-1);
      }

      return this.fastEmaResult;
  }

  private getSlowEMA(value: number) {
      this.slowEmaResult.unshift(this.slowEMA.nextValue(value));

      if (this.slowEmaResult.length === 3) {
          this.slowEmaResult.splice(-1);
      }

      return this.slowEmaResult;
  }
}
