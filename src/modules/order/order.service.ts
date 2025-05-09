import type { Request, Response } from 'express';
import type { CustomRequest } from '../../middlewares/verifyauth.js';
import { handleBadRequest, handleError, handleSuccess } from '../../constants/response-handler.js';
import type { ICreateOrder, TallOrders } from '../../interfaces/orders.js';
import { dataSource } from '../../database/dataSource.js';
import { Product } from '../../database/entites/product.entity.js';
import { Store } from '../../database/entites/store.entity.js';

import { Orders } from '../../database/entites/orders.entity.js';
import moment from 'moment';
import type { IPaginate } from '../../interfaces/pagination.js';
import { LogHelper } from '../../utils/LogHelper.js';
import { ORDER_STATUS } from '../../constants/result.js';
import { manipulateOrderItem } from '../../utils/order-helpers.js';
import { transporter } from '../../mailproviders/nodemailer.js';
import { sendOrderMail } from '../../mailproviders/sendordermail.js';
import { Coupon } from '../../database/entites/coupon.entity.js';
import type { ITokenPayload } from '../../utils/token-helper.js';

export const createOrder = async (req: Request, res: Response) => {
	try {
		const { productid, qty, payment_gateway, order_from, coupon_id, device_type }: ICreateOrder =
			req.body;

		if (!productid || !qty || !payment_gateway || !order_from) {
			return handleBadRequest(res, 400, 'all field is required');
		}

		// Find Product
		const isProduct = await dataSource.getRepository(Product).findOne({
			where: {
				id: productid,
			},
		});

		if (!isProduct) {
			return handleBadRequest(res, 400, 'product does not exist');
		}

		if (isProduct.amount <= 0) {
			return handleBadRequest(res, 400, 'product amount cannot be zero');
		}

		// find shop
		const isShop = await dataSource.getRepository(Store).findOne({
			where: {
				id: isProduct.shop_id.id,
			},
			loadEagerRelations: true,
		});

		if (!isShop) {
			return handleBadRequest(res, 400, 'shop does not exist');
		}

		let shopcredit = 31;

		if (shopcredit <= 0) {
			return handleBadRequest(
				res,
				400,
				'Cannot create an order at the moment, Reach out to store owner.'
			);
		}

		let shopownerEmail = isShop.email;

		if (shopcredit < 5) {
			// Send mail
			const creditsMail = {
				from: 'admin.AnyBuy',
				to: shopownerEmail,
				subject: 'Low credit',
				html: `<div>
            <p> Hello  ${isShop.storename} </p>
            <p> <h3> Your credits on is Running low, Please Recharge </h3></p>
            </div>`,
			};

			transporter.sendMail(creditsMail, function (error, info) {
				if (error) {
					// Log error for unsent mail
					LogHelper.error(error);
				} else {
					// Mail sent successfully
					LogHelper.info('Email sent: ' + info.response);
				}
			});
		}

		// Create order

		let totalOrderAmount = qty * isProduct.amount;

		let valueofCoupon = 0;
		let typeOfCoupon = null;

		if (coupon_id && coupon_id !== '') {
			// find coupon
			const couponCode = await Coupon.findOne({
				where: {
					id: coupon_id,
				},
			});

			//  && couponCode.max_use > couponCode.total_usage
			if (couponCode) {
				// Set value
				valueofCoupon = couponCode.coupon_value;
				typeOfCoupon = couponCode.type;

				if (couponCode.type === 'percent') {
					const new_amount = qty * isProduct.amount;

					let discountRate = (couponCode.coupon_value / 100).toFixed(2); //discount rate
					const discountedPrice = new_amount - new_amount * parseFloat(discountRate);

					totalOrderAmount = discountedPrice;
				}

				if (couponCode.type === 'fixed') {
					totalOrderAmount = totalOrderAmount - +couponCode.coupon_value;
				}

				couponCode.total_usage = couponCode.total_usage + 1;
				couponCode.save();
			}
		}

		const createOrders = dataSource.getRepository(Orders).create({
			qty,
			shop_id: isShop,
			payment_gateway,
			order_from: order_from,
			total_amount: totalOrderAmount,
			productid: isProduct.id,
			product_name: isProduct.name,
			product_price: isProduct.amount,
			product_type: isProduct.product_type,
			coupon_value: valueofCoupon,
			applied_coupon: typeOfCoupon,
			device_type: device_type ? device_type : 'unknown',
		});

		const result = await dataSource.getRepository(Orders).save(createOrders);

		return handleSuccess(res, { id: result.id }, 'created', 201, undefined);
	} catch (error) {
		return handleError(res, error);
	}
};

export const getOrderById = async (req: Request, res: Response) => {
	try {
		const { orderid }: { orderid?: string } = req.query;

		if (!orderid) {
			return handleBadRequest(res, 400, 'orderid is required');
		}

		const orderRepository = dataSource.getRepository(Orders);
		const OrderData = await orderRepository
			.createQueryBuilder('o')
			.leftJoin('o.shop_id', 's') // use the correct relation name here
			.addSelect(['s.id', 's.storename', 's.display_picture', 's.discord_link'])
			.where('o.id = :orderid', { orderid: orderid })
			.getOne();

		if (!OrderData) {
			return handleBadRequest(res, 400, 'order cannot be found');
		}

		return handleSuccess(res, OrderData, '', 200, undefined);
	} catch (error) {
		return handleError(res, error);
	}
};

export const getStoreOrders = async (req: CustomRequest, res: Response) => {
	try {
		const { page, limit, status, startDate, endDate, gateway }: TallOrders = req.query;

		const storeReq = req.user as ITokenPayload;

		const page_limit = limit ? Number(limit) : 10;

		const offset = page ? (Number(page) - 1) * page_limit : 0;

		// find shop
		const isShop = await dataSource.getRepository(Store).findOne({
			where: {
				id: storeReq.id,
			},
		});

		if (!isShop) {
			return handleBadRequest(res, 400, 'shop does not exist');
		}

		// fetch all shop product
		const query = dataSource.getRepository(Orders).createQueryBuilder('q');

		query.where('q.shop_id = :shopval', { shopval: storeReq.id });

		if (status && status !== '') {
			query.andWhere('q.order_status = :status', { status });
		}

		if (gateway && gateway !== '') {
			query.andWhere('q.payment_gateway = :gateway', { gateway });
		}

		if (startDate && startDate !== '') {
			const start = moment(startDate).toISOString();
			query.andWhere(`q.created_at >= '${start}'`);
		}
		if (endDate && endDate !== '') {
			const end = moment(endDate).toISOString();
			query.andWhere(`q.created_at <= '${end}'`);
		}

		const allOrders = await query
			.offset(offset)
			.limit(page_limit)
			.orderBy('q.created_at', 'DESC')
			.getMany();

		const orderCount = await query.getCount();

		const totalPages = Math.ceil(orderCount / page_limit);

		const paging: IPaginate = {
			totalItems: orderCount,
			currentPage: page ? Number(page) : 1,
			totalpages: totalPages,
			itemsPerPage: page_limit,
		};

		return handleSuccess(res, allOrders, '', 200, paging);
	} catch (error) {
		return handleError(res, error);
	}
};

export const approveOrder = async (req: CustomRequest, res: Response) => {
	try {
		const { orderid }: { orderid?: string } = req.query;

		if (!orderid) {
			return handleBadRequest(res, 400, 'orderid is required');
		}

		const OrderData = await dataSource.getRepository(Orders).findOne({
			where: {
				id: orderid,
			},
			loadEagerRelations: false,
		});

		if (!OrderData) {
			return handleBadRequest(res, 400, 'order cannot be found');
		}

		// const manipulate_result = await manipulateOrderItem(OrderData.id, OrderData.productid);
		const manipulate_result = false;

		if (!manipulate_result) {
			return handleBadRequest(res, 400, 'failed to approve order');
		}

		// Send email to user about order
		await sendOrderMail(OrderData.id);

		return handleSuccess(res, '', '', 200, undefined);
	} catch (error) {
		return handleError(res, error);
	}
};

export const disapproveOrder = async (req: CustomRequest, res: Response) => {
	try {
		const { orderid }: { orderid?: string } = req.query;

		if (!orderid) {
			return handleBadRequest(res, 400, 'orderid is required');
		}

		const OrderData = await dataSource.getRepository(Orders).findOne({
			where: {
				id: orderid,
			},
		});

		if (!OrderData) {
			return handleBadRequest(res, 400, 'order cannot be found');
		}

		OrderData.order_status = ORDER_STATUS.UNPAID;

		OrderData.save();

		return handleSuccess(res, OrderData, '', 200, undefined);
	} catch (error) {
		return handleError(res, error);
	}
};

export const getPopularPayment = async (req: CustomRequest, res: Response) => {
	try {
		const shopid = req.query.shopid as any;
		// find shop
		const isShop = await dataSource.getRepository(Store).findOne({
			where: {
				id: shopid,
			},
			// loadEagerRelations: true,
		});

		if (!isShop) {
			return handleBadRequest(res, 400, 'shop does not exist');
		}

		// fetch orders by shop
		const ordersGroupedByPaymentGateway = await Orders.createQueryBuilder('order')
			.select('order.payment_gateway', 'payment_gateway')
			.where('order.shop_id = :shopId', { shopId: shopid })
			.addSelect('COUNT(order.id)', 'order_count')
			.addSelect('SUM(order.total_amount)', 'overall')
			.groupBy('order.payment_gateway')
			.orderBy('order_count', 'DESC')
			.getRawMany();

		return handleSuccess(res, ordersGroupedByPaymentGateway, '', 200, undefined);
	} catch (error) {
		return handleError(res, error);
	}
};
