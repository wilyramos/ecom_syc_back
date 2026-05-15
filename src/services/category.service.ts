// File: backend/src/services/category.service.ts
import Category from "../models/Category";

export const getCategoryFamilyIds = async (rootCategoryId: string) => {
    // 1. Buscamos todas las categorías cuyo 'parent' sea el ID que recibimos
    const subcategories = await Category.find({ parent: rootCategoryId })
        .select('_id')
        .lean();

    // 2. Extraemos los IDs de los hijos
    const subcategoryIds = subcategories.map(cat => cat._id);

    // 3. Retornamos el ID Padre + IDs Hijos
    return [rootCategoryId, ...subcategoryIds];
};