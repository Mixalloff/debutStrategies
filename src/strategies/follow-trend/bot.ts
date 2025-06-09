import { MACD, SMA, Stochastic } from '@debut/indicators';
import { SessionPluginOptions, sessionPlugin } from '@debut/plugin-session';
import { VirtualTakesOptions, virtualTakesPlugin } from '@debut/plugin-virtual-takes';
import { ReportPluginAPI, IndicatorsSchema, FigureType } from '@debut/plugin-report';
import { statsPlugin, StatsPluginAPI } from '@debut/plugin-stats';
import { Debut } from '@debut/community-core';
import { math } from '@debut/plugin-utils';
import { DebutOptions, BaseTransport, OrderType, Candle } from '@debut/types';

export interface FTOptions extends DebutOptions, SessionPluginOptions, VirtualTakesOptions {
  fastPeriod: number;
  slowPeriod: number;
  openPercent: number;
}
export class FTBot extends Debut {
  declare opts: FTOptions;
  declare plugins: StatsPluginAPI & ReportPluginAPI;

  private sma: SMA;
  private slowSMA: SMA;
  private fastSmaResult: number[] = [];
  private slowSmaResult: number[] = [];
  private allowOrders = true;
  FLOATING_STOP_PERCENT = .02;
  floatingLossMap = new Map();
  // MACD setup
  private macd: MACD;
  private macdValue: {
    macd: number;
    emaFast: number;
    emaSlow: number;
    signal: number;
    histogram: number;
  };
  // Sotchastic setup
  private stoch: Stochastic;
  private stochValue: {
    k: number;
    d: number;
  };

  constructor(transport: BaseTransport, opts: FTOptions) {
    super(transport, opts);

    this.sma = new SMA(this.opts.fastPeriod);
    this.slowSMA = new SMA(this.opts.slowPeriod);
    this.macd = new MACD(opts.fastPeriod, opts.slowPeriod, 5);
    this.stoch = new Stochastic(25, 8);

    this.registerPlugins([
      this.opts.from && this.opts.to && sessionPlugin(this.opts),
      virtualTakesPlugin(this.opts),
      statsPlugin(this.opts),
    ]);
  }

  public getIndicators = (): IndicatorsSchema => {
    return [
      {
        name: 'ft',
        figures: [
          {
            name: 'fast',
            getValue: () => {
              return this.fastSmaResult[0];
            },
          },
          {
            name: 'slow',
            getValue: () => {
              return this.slowSmaResult[0];
            },
          },
        ],
        inChart: true,
      },
      {
        name: 'MACD Indicator',
        figures: [
          {
            name: 'macd',
            getValue: () => {
              return this.macdValue?.macd;
            },
          },
          {
            name: 'signal',
            getValue: () => {
              return this.macdValue?.signal;
            },
          },
          {
            name: 'histogram',
            type: FigureType.bar,
            getValue: () => {
              return this.macdValue?.signal;
            },
          },
        ],
      },
      {
        name: 'Stoch Indicator',
        figures: [
          {
            name: 'K',
            getValue: () => {
              return this.stochValue?.k;
            },
          },
          {
            name: 'D',
            getValue: () => {
              return this.stochValue?.d;
            },
          },
        ],
      },
    ];
  };

  async openMonitoring(c: number, fastSMA?: number[], slowSMA?: number[]) {
    const percent = Math.abs(math.percentChange(fastSMA[0], slowSMA[0]));
    const order = this.orders[0];

    if (!order) {
      if (
        fastSMA[0] >= slowSMA[0] &&
        fastSMA[1] < slowSMA[1]
      ) {
        const newOrder = await this.createOrder(OrderType.BUY);
        this.allowOrders = false;
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
        this.allowOrders = false;
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

  async onCandle({ o, h, l, c }: Candle) {
    try {
      const prevMacdValue = this.macdValue;
      const prevStochValue = this.stochValue;

      this.macdValue = this.macd.nextValue(c);
      this.stochValue = this.stoch.nextValue(h, l, c);

      // Проверяем статус активного ордера, только на закрытие свечи
      const fastSMA = this.getFastSMA(c);
      const slowSMA = this.getSlowSMA(c);

      // this.indicators = { fastSMA: fastSMA, slowSMA: slowSMA };
      await this.openMonitoring(c, fastSMA, slowSMA);
    } catch (e) {
      console.log(this.getName(), e);
    }
  }

  private getFastSMA(value: number) {
    this.fastSmaResult.unshift(this.sma.nextValue(value));

    if (this.fastSmaResult.length === 3) {
      this.fastSmaResult.splice(-1);
    }

    return this.fastSmaResult;
  }

  private getSlowSMA(value: number) {
    this.slowSmaResult.unshift(this.slowSMA.nextValue(value));

    if (this.slowSmaResult.length === 3) {
      this.slowSmaResult.splice(-1);
    }

    return this.slowSmaResult;
  }
}
