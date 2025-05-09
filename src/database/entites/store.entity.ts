import { Entity, Column, OneToOne } from 'typeorm';
import { CustomBaseEntity } from '../custom-base.entity.js';
import { Customization } from './customization.entity.js';

@Entity({ name: 'stores' })
export class Store extends CustomBaseEntity {
	@Column({ type: 'varchar', unique: true, nullable: false })
	storename!: string;

	@Column({ type: 'varchar', unique: true, nullable: true, default: 'sellit.app' })
	domain_name!: string;

	@Column({ type: 'text', nullable: true })
	hero_text!: string;

	@Column({ type: 'varchar', default: 'shop_admin' })
	user_type!: string;

	@Column({ type: 'varchar', unique: false, nullable: false })
	email!: string;

	@Column({ type: 'varchar', unique: false, nullable: true })
	parent_store!: string;

	@Column({ type: 'varchar', nullable: true })
	telephone!: string;

	@Column({ type: 'varchar', nullable: true })
	display_picture!: string;

	@Column({ type: 'boolean', default: false })
	active!: boolean;

	@Column({ type: 'varchar', nullable: true })
	token!: string | null;

	@Column({ type: 'varchar', nullable: true })
	discord_link!: string;

	@Column({ type: 'varchar', nullable: true })
	stripe_key!: string | null;

	@Column({ type: 'varchar', nullable: true })
	coinbase_key!: string | null;

	@Column({ type: 'varchar', nullable: true })
	cashapp_tag!: string | null;

	@Column({ nullable: false })
	password!: string;

	@Column({ nullable: false })
	salt!: string;

	@Column({
		type: 'simple-array',
		nullable: false,
		default: ['product:read', 'product:delete', 'payment:create', 'coupon:create', 'auth:create'],
	})
	permissions!: string;

	@Column({ type: 'uuid', nullable: true })
	customizationid!: string;

	// SET NOTIFICATIONS
	@Column({ type: 'boolean', default: false })
	create_ticket!: boolean;

	@Column({ type: 'boolean', default: false })
	reply_ticket!: boolean;
}
