// File: backend/src/modules/sliderbanner/sliderbanner.model.ts
import mongoose, { Schema, Document, Types, PopulatedDoc } from 'mongoose';
import { IProduct } from '../../models/Product';
import { IBrand } from '../../models/Brand';
import { ICategory } from '../../models/Category';

export type SliderLayout =
    | 'default' | 'image-left' | 'image-center' | 'image-center-split'
    | 'background-media' | 'promo-box' | 'fullbleed' | 'split-diagonal'
    | 'minimal' | 'countdown' | 'video';

export type SliderTheme = 'dark' | 'light' | 'custom';
export type SliderContentType = 'product' | 'brand' | 'category' | 'campaign' | 'custom';

// SINCRONIZADO: Incluye todos los border styles disponibles en ImageBorder.tsx
export type SliderBorderStyle =
    | 'none'
    | 'curved-frame'
    | 'simple'
    | 'double'
    | 'rounded-top'
    | 'rounded-all'
    | 'dashed'
    | 'dotted'
    | 'double-corner'
    | 'floating'
    | 'film-frame'
    | 'asymmetric'
    | 'glass-effect'
    | 'neon-glow'
    | 'minimal-frame'
    | 'diagonal-cut';

export interface ISliderPrice {
    current?: number;
    compare?: number;
    label?: string;
    suffix?: string;
    note?: string;
    currency: string;
    border?: SliderBorderStyle;
}

export interface ISliderMedia {
    imageUrl: string;
    videoUrl?: string;
    videoPoster?: string;
    altText: string;
    objectFit: 'contain' | 'cover' | 'fill';
    border?: SliderBorderStyle;
}

export interface ISliderDesign {
    layout: SliderLayout;
    theme: SliderTheme;
    bgColor?: string;
    accentColor?: string;
    textColor?: string;
    textMutedColor?: string;
    contentDistribution?: {
        leftSide: Array<'title' | 'subtitle' | 'description' | 'price'>;
        rightSide: Array<'title' | 'subtitle' | 'description' | 'price'>;
    };
}

export interface ISliderCountdown {
    endsAt: Date;
    label?: string;
    showDays: boolean;
}

export interface ISliderBanner extends Document {
    contentType: SliderContentType;
    product?: Types.ObjectId | PopulatedDoc<IProduct>;
    brand?: Types.ObjectId | PopulatedDoc<IBrand>;
    category?: Types.ObjectId | PopulatedDoc<ICategory>;
    title?: string;
    subtitle?: string;
    description?: string;
    price?: ISliderPrice;
    destUrl: string;
    media: ISliderMedia;
    design: ISliderDesign;
    countdown?: ISliderCountdown;
    isActive: boolean;
    order: number;
    schedule?: {
        startsAt?: Date;
        endsAt?: Date;
    };
}

const borderStylesEnum = [
    'none',
    'curved-frame',
    'simple',
    'double',
    'rounded-top',
    'rounded-all',
    'dashed',
    'dotted',
    'double-corner',
    'floating',
    'film-frame',
    'asymmetric',
    'glass-effect',
    'neon-glow',
    'minimal-frame',
    'diagonal-cut',
] as const;

const sliderBannerSchema = new Schema<ISliderBanner>({
    contentType: {
        type: String,
        enum: ['product', 'brand', 'category', 'campaign', 'custom'],
        default: 'product',
    },
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    brand: { type: Schema.Types.ObjectId, ref: 'Brand' },
    category: { type: Schema.Types.ObjectId, ref: 'Category' },

    title: { type: String, trim: true },
    subtitle: { type: String },
    description: { type: String },

    price: {
        current: { type: Number },
        compare: { type: Number },
        label: { type: String },
        suffix: { type: String },
        note: { type: String },
        currency: { type: String, default: 'S/' },
        border: {
            type: String,
            enum: borderStylesEnum,
            default: 'none',
        },
    },

    destUrl: { type: String, required: true },

    media: {
        imageUrl: { type: String, required: true },
        videoUrl: { type: String },
        videoPoster: { type: String },
        altText: { type: String, required: true },
        objectFit: { type: String, enum: ['contain', 'cover', 'fill'], default: 'cover' },
        border: {
            type: String,
            enum: borderStylesEnum,
            default: 'none',
        },
    },

    design: {
        layout: {
            type: String,
            enum: [
                'default', 'image-left', 'image-center', 'image-center-split',
                'background-media', 'promo-box', 'fullbleed', 'split-diagonal',
                'minimal', 'countdown', 'video'
            ],
            default: 'default',
        },
        theme: { type: String, enum: ['dark', 'light', 'custom'], default: 'dark' },
        bgColor: { type: String },
        accentColor: { type: String },
        textColor: { type: String },
        textMutedColor: { type: String },
        contentDistribution: {
            leftSide: [String],
            rightSide: [String],
        },
    },

    countdown: {
        endsAt: { type: Date },
        label: { type: String },
        showDays: { type: Boolean, default: true },
    },

    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },

    schedule: {
        startsAt: { type: Date },
        endsAt: { type: Date },
    },
}, {
    timestamps: true,
});

export default mongoose.model<ISliderBanner>('SliderBanner', sliderBannerSchema);