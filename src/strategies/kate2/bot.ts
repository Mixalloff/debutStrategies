import { Debut } from "@debut/community-core";
import { EMA, SMA } from "@debut/indicators";
import { IndicatorsSchema, ReportPluginAPI } from "@debut/plugin-report";
import { sessionPlugin, SessionPluginOptions } from "@debut/plugin-session";
import { statsPlugin, StatsPluginAPI } from "@debut/plugin-stats";
import { VirtualTakesOptions, virtualTakesPlugin } from "@debut/plugin-virtual-takes";
import { BaseTransport, Candle, DebutOptions, OrderType } from "@debut/types";

export interface Kate2Options extends DebutOptions, SessionPluginOptions, VirtualTakesOptions {
  fastPeriod: number;
  slowPeriod: number;
  openPercent: number;
}

/**
 * Катя 2. На недельном.
 * Когда 10ЕМА пересекает 20ЕМА - заявка на 50 ЕМА.
 * Плавающий стоп 5%
 */
export class Kate2Bot extends Debut {
  declare plugins: StatsPluginAPI & ReportPluginAPI;

  private ema: EMA;
  private slowEMA: EMA;
  private fastEmaResult: number[] = [];
  private slowEmaResult: number[] = [];
  // private allowOrders = true;
  FLOATING_STOP_PERCENT = .02;
  floatingLossMap = new Map();

  constructor(transport: BaseTransport, public opts: Kate2Options) {
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

  async openMonitoring(c: number, fastSMA?: number[], slowSMA?: number[]) {
    // const percent = Math.abs(math.percentChange(fastSMA[0], slowSMA[0]));
    const order = this.orders[0];

    if (!order) {
      if (
        fastSMA[0] >= slowSMA[0] &&
        fastSMA[1] < slowSMA[1]
      ) {
        const newOrder = await this.createOrder(OrderType.BUY);
        // this.allowOrders = false;
        this.floatingLossMap.set(
          newOrder.cid,
          newOrder.price * (1 - this.FLOATING_STOP_PERCENT)
        );
      }

      if (
        fastSMA[0] <= slowSMA[0] &&
        fastSMA[1] > slowSMA[1]
      ) {
        const newOrder = await this.createOrder(OrderType.SELL);
        // this.allowOrders = false;
        this.floatingLossMap.set(
          newOrder.cid,
          newOrder.price * (1 + this.FLOATING_STOP_PERCENT)
        );
      }
    } else {
      const currentStopLoss = this.floatingLossMap.get(order.cid);
      const delta = Math.abs((currentStopLoss - c) / currentStopLoss);
      if (order.type === OrderType.SELL) {
        // console.log(order.price, c, currentStopLoss, delta)
        if (c >= currentStopLoss) {
          // console.log('closeOrder', order, c)
          await this.closeOrder(order);
          return;
        }
        if (delta > this.FLOATING_STOP_PERCENT) {
          // console.log(`${c}: move from: ${currentStopLoss} to ${c * (1 + this.FLOATING_STOP_PERCENT)}`)
          this.floatingLossMap.set(
            order.cid,
            c * (1 + this.FLOATING_STOP_PERCENT)
          )
        }
      } else {
        // console.log(order.price, currentStopLoss, c)
        if (c <= currentStopLoss) {
          // console.log('closeOrder', order, c)
          await this.closeOrder(order);
          return;
        }
        if (delta > this.FLOATING_STOP_PERCENT) {
          // console.log(`${c}: move from: ${currentStopLoss} to ${c * (1 - this.FLOATING_STOP_PERCENT)}`)

          this.floatingLossMap.set(
            order.cid,
            c * (1 - this.FLOATING_STOP_PERCENT)
          )
        }
      }
    }
  }

  async onCandle({ c }: Candle) {
    try {
      // Проверяем статус активного ордера, только на закрытие свечи
      const fastEMA = this.getFastEMA(c);
      const slowEMA = this.getSlowEMA(c);

      // this.indicators = { fastSMA: fastSMA, slowSMA: slowSMA };
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
