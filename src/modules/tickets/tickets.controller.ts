import { Router } from 'express';
import { validateRequest } from '../../middlewares/validate-body.js';
import {
	CreateTicket,
	fetchStoreTickets,
	resolveTickets,
	searchTickets,
} from './tickets.service.js';
import { postTicketSchema } from './tickets.schema.js';
import { verifyToken } from '../../middlewares/verifyauth.js';

const TicketsRouter = Router();

TicketsRouter.get('/store', verifyToken, fetchStoreTickets);
TicketsRouter.patch('/resolve', verifyToken, resolveTickets);
TicketsRouter.get('/search', verifyToken, searchTickets);

TicketsRouter.post('/public', validateRequest(postTicketSchema), CreateTicket);

export const TicketsController = { router: TicketsRouter };
