import slugify from "slugify";
import Product from "../models/Product";

export async function generateUniqueSlug(nombre: string): Promise<string> {
    const baseSlug = slugify(nombre, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    // Mientras exista otro producto con el mismo slug, agrega sufijo
    while (await Product.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    return slug;
}
