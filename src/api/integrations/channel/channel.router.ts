import { Router } from 'express';

import { EvolutionRouter } from './evolution/evolution.router';
import { MetaRouter } from './meta/meta.router';
import { BaileysRouter } from './whatsapp/baileys.router';
import { WebJSRouter } from './whatsapp/webjs.router';

export class ChannelRouter {
  public readonly router: Router;

  constructor(configService: any, ...guards: any[]) {
    this.router = Router();

    this.router.use('/', new EvolutionRouter(configService).router);
    this.router.use('/', new MetaRouter(configService).router);
    this.router.use('/baileys', new BaileysRouter(...guards).router);
    this.router.use('/webjs', new WebJSRouter(...guards).router);
  }
}
