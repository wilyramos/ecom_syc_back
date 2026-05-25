import mongoose, { Schema, Document } from 'mongoose';

export type SliderLayout =
    | 'image-only'        // Solo imagen/video, sin texto
    | 'default'           // Texto + imagen/video lado a lado
    | 'media-left'        // Texto + imagen/video, media a la izquierda
    | 'background-media'; // Imagen/video de fondo, texto encima

export type SliderTheme = 'dark' | 'light' | 'custom';

export interface ISliderMedia {
    imageUrl?: string;
    videoUrl?: string;
    videoPoster?: string;
    altText?: string;
    objectFit?: 'contain' | 'cover' | 'fill';
}

export interface ISliderPrice {
    current?: number;
    compare?: number;   // Precio tachado
    label?: string;     // "Desde", "Solo hoy"
    suffix?: string;    // "/ mes", "c/u"
    currency?: string;  // Default: 'S/'
}

export interface ISliderDesign {
    layout: SliderLayout;
    theme?: SliderTheme;
    bgColor?: string;
    accentColor?: string;
    textColor?: string;
}

export interface ISliderCountdown {
    endsAt?: Date;
    label?: string;
    showDays?: boolean;
}

export interface ISliderBanner extends Document {
    // ── Admin ──────────────────────────────
    name: string;           // Nombre interno: "Hero Verano 2025"
    tags?: string[];

    // ── Contenido ──────────────────────────
    title?: string;
    subtitle?: string;
    description?: string;
    terms?: string;         // Letra pequeña / T&C

    price?: ISliderPrice;

    // ── Destino ────────────────────────────
    destUrl?: string;
    openInNewTab?: boolean;

    // ── Media ──────────────────────────────
    media?: ISliderMedia;

    // ── Diseño ─────────────────────────────
    design: ISliderDesign;

    // ── Extras ─────────────────────────────
    countdown?: ISliderCountdown;

    // ── Control ────────────────────────────
    isActive: boolean;
    order: number;
    schedule?: {
        startsAt?: Date;
        endsAt?: Date;
    };
}

const sliderBannerSchema = new Schema<ISliderBanner>(
    {
        name: { type: String, required: true, trim: true },
        tags: [{ type: String, trim: true }],

        title:       { type: String, trim: true },
        subtitle:    { type: String, trim: true },
        description: { type: String, trim: true },
        terms:       { type: String, trim: true },

        price: {
            current:  { type: Number, min: 0 },
            compare:  { type: Number, min: 0 },
            label:    { type: String, trim: true },
            suffix:   { type: String, trim: true },
            currency: { type: String, default: 'S/' },
        },

        destUrl:      { type: String, trim: true },
        openInNewTab: { type: Boolean, default: false },

        media: {
            imageUrl:    { type: String, trim: true },
            videoUrl:    { type: String, trim: true },
            videoPoster: { type: String, trim: true },
            altText:     { type: String, trim: true },
            objectFit:   {
                type: String,
                enum: ['contain', 'cover', 'fill'],
                default: 'cover',
            },
        },

        design: {
            type: {
                layout: {
                    type: String,
                    enum: ['image-only', 'default', 'media-left', 'background-media'],
                    default: 'default',
                    required: true,
                },
                theme:       { type: String, enum: ['dark', 'light', 'custom'], default: 'dark' },
                bgColor:     { type: String },
                accentColor: { type: String },
                textColor:   { type: String },
            },
            default: () => ({ layout: 'default', theme: 'dark' })
        },

        countdown: {
            endsAt:   { type: Date },
            label:    { type: String, trim: true },
            showDays: { type: Boolean, default: true },
        },

        isActive: { type: Boolean, default: true },
        order:    { type: Number, default: 0 },

        schedule: {
            startsAt: { type: Date },
            endsAt:   { type: Date },
        },
    },
    { timestamps: true }
);

sliderBannerSchema.index({ isActive: 1, order: 1 });
sliderBannerSchema.index({ 'schedule.startsAt': 1, 'schedule.endsAt': 1 });
sliderBannerSchema.index({ tags: 1 });

export default mongoose.model<ISliderBanner>('SliderBanner', sliderBannerSchema);