//File: backend/src/schemas/line.schema.ts

import { z } from 'zod';

export const CreateLineSchema = z.object({
    nombre: z.string().min(2, "El nombre es muy corto"),
    slug: z.string().min(2).optional(), // Si no se envía, se genera en backend
    brand: z.string().length(24, "ID de marca inválido"), // MongoID length
    category: z.string().length(24).optional(),
    descripcion: z.string().optional(),
    descriptionSEO: z.string().optional(),
    h1Title: z.string().optional(),
    image: z.string().url().optional().or(z.literal('')),
    isActive: z.boolean().optional(),
});

export const UpdateLineSchema = CreateLineSchema.partial();