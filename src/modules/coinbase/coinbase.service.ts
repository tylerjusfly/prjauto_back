import type { Response, Request } from 'express';
import { handleBadRequest, handleError } from '../../constants/response-handler.js';
import type { ICreateCoinbase } from '../../interfaces/payment.interface.js';
import { dataSource } from '../../database/dataSource.js';
import { Orders } from '../../database/entites/orders.entity.js';
import { ENV } from '../../constants/env-variables.js';
import { manipulateOrderItem } from '../../utils/order-helpers.js';
import { sendOrderMail } from '../../mailproviders/sendordermail.js';
import https from 'https';

export const coinBaseChargeForVendors = async (req: Request, res: Response) => {
	try {
		const { orderid }: ICreateCoinbase = req.body;

		if (!orderid) {
			return handleBadRequest(res, 400, 'all field is required');
		}

		// getting host address to route for success
		const origin = `${req.secure ? 'https://' : 'http://'}${req.headers.host}`;

		const url = 'https://api.commerce.coinbase.com/charges';

		// Fetch shop
		const isOrder = await dataSource.getRepository(Orders).findOne({
			where: {
				id: orderid,
			},
			loadEagerRelations: true,
		});

		if (!isOrder) {
			return handleBadRequest(res, 400, 'order does not exist');
		}

		const shop = isOrder.shop_id;

		const shopCoinbaseKey = shop.coinbase_key;

		if (!shopCoinbaseKey) {
			return handleBadRequest(res, 400, 'Payment with coinbase is not alllowed yet');
		}

		const agent = new https.Agent({ keepAlive: true });

		const options = {
			method: 'POST',
			agent,
			headers: {
				Accept: 'application/json',
				'X-CC-Api-Key': shopCoinbaseKey,
				'X-CC-Api-Version': ' 2018-03-22',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				local_price: { amount: isOrder.total_amount, currency: 'USD' },
				name: isOrder.product_name,
				pricing_type: 'fixed_price',
				redirect_url: `${origin}/coinbase/success/${orderid}/${shop.storename}`,
				cancel_url: `${ENV.FRONTEND_URL}/${shop.storename}`,
				description: `payment for ${isOrder.product_name} to ${shop.storename} `,
				// logo_url:'',
			}),
		};

		// Send request
		fetch(url, options)
			.then((result) => result.json())
			.then((jsondata) => {
				// if (jsondata.error) {
				// 	return handleError(res, jsondata.error);
				// } else {
				// 	res.json({
				// 		success: true,
				// 		url: jsondata.data?.hosted_url,
				// 		// url: 'http://localhost:3000/store/kfc/',
				// 	});
				// }
			})
			.catch((err) => {
				console.error('errorme:' + err);
				return handleError(res, { message: 'unable to initiate coinbase charge' });
			});
	} catch (error) {
		return handleError(res, error);
	}
};

export const coinbaseSuccess = async (req: Request, res: Response) => {
	const { orderid, shop }: { orderid?: string; shop?: string } = req.params;
	try {
		if (!orderid || !shop) {
			return res.redirect(`${ENV.FRONTEND_URL}`);
		}

		const isOrder = await dataSource.getRepository(Orders).findOne({
			where: {
				id: orderid,
			},
			loadEagerRelations: true,
		});

		if (!isOrder) {
			return res.redirect(`${ENV.FRONTEND_URL}/store/${shop}`);
		}

		/**Change order */

		await manipulateOrderItem(isOrder.id, isOrder.productid);

		// if (!manipulate_result) {
		// 	return handleBadRequest(res, 400, 'failed to approve order');
		// }

		// Send email to user about order
		await sendOrderMail(isOrder.id);

		return res.redirect(`${ENV.FRONTEND_URL}/store/${shop}/order/${orderid}`);
	} catch (error) {
		return res.redirect(`${ENV.FRONTEND_URL}/store/${shop}`);
	}
};
