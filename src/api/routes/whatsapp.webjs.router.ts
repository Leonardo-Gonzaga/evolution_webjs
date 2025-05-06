import { Router } from 'express';
import { whatsappWebJSController } from '../controllers/whatsapp.webjs.controller';
import { authGuard } from '../guards/auth.guard';

const whatsappWebJSRouter = Router();
const routeBase = '/whatsapp-webjs';

// Middleware de autenticação para todas as rotas
whatsappWebJSRouter.use(authGuard.handle);

// Rotas para gerenciamento de instâncias
whatsappWebJSRouter.post('/instance', whatsappWebJSController.createInstance.bind(whatsappWebJSController));
whatsappWebJSRouter.get('/instances', whatsappWebJSController.listInstances.bind(whatsappWebJSController));
whatsappWebJSRouter.delete('/instance/:instanceName', whatsappWebJSController.deleteInstance.bind(whatsappWebJSController));

// Rota para obter QR Code
whatsappWebJSRouter.get('/instance/:instanceName/qrcode', whatsappWebJSController.getQRCode.bind(whatsappWebJSController));

// Rotas para envio de mensagens
whatsappWebJSRouter.post('/instance/:instanceName/send-message', whatsappWebJSController.sendMessage.bind(whatsappWebJSController));

// Rotas para gerenciamento de grupos
whatsappWebJSRouter.get('/instance/:instanceName/groups', whatsappWebJSController.listGroups.bind(whatsappWebJSController));
whatsappWebJSRouter.post('/instance/:instanceName/group', whatsappWebJSController.createGroup.bind(whatsappWebJSController));

export { whatsappWebJSRouter, routeBase };